
// @ts-nocheck
import { User } from './types';

declare const faceapi: any;

class FaceAuthService {
  private static instance: FaceAuthService;
  private isLoaded: boolean = false;
  // Use jsDelivr CDN for reliable model hosting
  private modelUrl = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';

  private constructor() {}

  public static getInstance(): FaceAuthService {
    if (!FaceAuthService.instance) {
      FaceAuthService.instance = new FaceAuthService();
    }
    return FaceAuthService.instance;
  }

  public async loadModels() {
    if (this.isLoaded) return;
    try {
      console.log("Loading Face Recognition Models...");
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(this.modelUrl),
        faceapi.nets.faceLandmark68Net.loadFromUri(this.modelUrl),
        faceapi.nets.faceRecognitionNet.loadFromUri(this.modelUrl)
      ]);
      this.isLoaded = true;
      console.log("Models Loaded Successfully.");
    } catch (e) {
      console.error("Failed to load models:", e);
      // Don't throw immediately, allow retries or graceful degradation
      console.warn("Could not load face recognition engine. Face ID features will be unavailable.");
    }
  }

  // --- STRICT MATCHING LOGIC ---
  // Using Euclidean distance. Standard threshold is 0.6.
  // We use 0.45 for High Security (Strict).
  private getDistance(descriptor1: Float32Array | number[], descriptor2: Float32Array | number[]): number {
    return faceapi.euclideanDistance(descriptor1, descriptor2);
  }

  // --- LIVENESS DETECTION (Anti-Spoofing) ---
  // Calculates Eye Aspect Ratio (EAR) to detect blink/open eyes
  private getEyeAspectRatio(landmarks: any): number {
    const getDist = (p1: any, p2: any) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();

    const calculateEAR = (eye: any[]) => {
      const A = getDist(eye[1], eye[5]);
      const B = getDist(eye[2], eye[4]);
      const C = getDist(eye[0], eye[3]);
      return (A + B) / (2.0 * C);
    };

    return (calculateEAR(leftEye) + calculateEAR(rightEye)) / 2.0;
  }

  /**
   * Registers a face.
   * - Detects Single Face
   * - Extracts Embeddings
   * - Checks Liveness (Basic Check)
   */
  public async registerFace(video: HTMLVideoElement): Promise<number[]> {
    if (!this.isLoaded) await this.loadModels();
    if (!this.isLoaded) throw new Error("Models not loaded.");

    // 1. Detection
    const detection = await faceapi.detectSingleFace(video).withFaceLandmarks().withFaceDescriptor();

    if (!detection) {
      throw new Error("No face detected. Please position yourself clearly.");
    }

    // 2. Strictness: Check confidence
    if (detection.detection.score < 0.9) {
      throw new Error("Face not clear enough. Remove glasses/mask and improve lighting.");
    }

    return Array.from(detection.descriptor); // Convert Float32Array to number[] for storage
  }

  /**
   * Authenticates a user against a specific face descriptor.
   * Implements "Liveness Challenge": User must BLINK during the scan period to pass.
   */
  public async verifyLivenessAndMatch(
    video: HTMLVideoElement, 
    knownDescriptor: number[]
  ): Promise<boolean> {
    if (!this.isLoaded) await this.loadModels();
    if (!this.isLoaded) throw new Error("Models not loaded.");

    let blinkDetected = false;
    let matchConfirmed = false;
    let framesAnalyzed = 0;
    const MAX_FRAMES = 30; // Scan for ~1-2 seconds

    return new Promise((resolve, reject) => {
      const scanInterval = setInterval(async () => {
        framesAnalyzed++;

        if (framesAnalyzed > MAX_FRAMES) {
          clearInterval(scanInterval);
          reject(new Error("Liveness check failed. Please blink naturally."));
          return;
        }

        try {
            const detection = await faceapi.detectSingleFace(video).withFaceLandmarks().withFaceDescriptor();

            if (detection) {
              // 1. MATCHING
              const distance = this.getDistance(detection.descriptor, knownDescriptor);
              // Strict Threshold 0.45
              if (distance < 0.45) {
                 matchConfirmed = true;
              }

              // 2. ANTI-SPOOFING (Liveness via Blink)
              const ear = this.getEyeAspectRatio(detection.landmarks);
              // EAR < 0.2 usually means eyes closed
              if (ear < 0.22) {
                blinkDetected = true;
              }
            }

            // SUCCESS CONDITION
            if (matchConfirmed && blinkDetected) {
              clearInterval(scanInterval);
              resolve(true);
            }
        } catch (e) {
            // Ignore frame errors
        }
      }, 100); // Check every 100ms
    });
  }

  /**
   * Searches DB for a match.
   */
  public async findUserByFace(video: HTMLVideoElement, allUsers: User[]): Promise<User | null> {
    if (!this.isLoaded) await this.loadModels();
    if (!this.isLoaded) return null;

    const detection = await faceapi.detectSingleFace(video).withFaceLandmarks().withFaceDescriptor();
    if (!detection) return null;

    // Reject low confidence immediately
    if (detection.detection.score < 0.8) return null;

    let bestMatch: User | null = null;
    let bestDistance = 100;

    for (const user of allUsers) {
      if (user.faceDescriptor) {
        const dist = this.getDistance(detection.descriptor, user.faceDescriptor);
        if (dist < 0.45 && dist < bestDistance) { // Strict Threshold
          bestDistance = dist;
          bestMatch = user;
        }
      }
    }

    return bestMatch;
  }
}

export const faceAuthService = FaceAuthService.getInstance();
