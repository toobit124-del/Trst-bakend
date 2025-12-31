
import { db as localDB, auth } from './backend';
import { User } from './types';

class MonitorService {
  private static instance: MonitorService;
  private users: User[] = [];
  private listeners: ((users: User[]) => void)[] = [];

  private constructor() {}

  public static getInstance(): MonitorService {
    if (!MonitorService.instance) {
      MonitorService.instance = new MonitorService();
    }
    return MonitorService.instance;
  }

  public startMonitoring() {
    const fetchUsers = async () => {
        // In local DB, we can just get all users for the monitor list simulation
        const allUsers = await localDB.users.search(''); 
        this.users = allUsers;
        this.notifyListeners();
    };
    
    fetchUsers();
    window.addEventListener('local-db-update', fetchUsers);
  }

  public subscribe(callback: (users: User[]) => void) {
    this.listeners.push(callback);
    callback([...this.users]);
    if (auth.currentUser) {
      this.startMonitoring();
    }
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(l => l([...this.users]));
  }

  public getAllUsers() {
    return [...this.users];
  }
}

export const monitorService = MonitorService.getInstance();
