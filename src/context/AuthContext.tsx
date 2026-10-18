import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Hospital, UserRole } from '../types/database';
import { db } from '../services/db';

interface AuthContextType {
  currentUser: User | null;
  currentHospital: Hospital | null;
  selectedHospitalId: string | 'all';
  hospitals: Hospital[];
  role: UserRole | null;
  isSuperAdmin: boolean;
  isHospitalAdmin: boolean;
  isStaff: boolean;
  isAuthenticated: boolean;
  login: (email: string, password?: string) => Promise<boolean>;
  logout: () => void;
  switchHospital: (hospitalId: string | 'all') => Promise<void>;
  switchUserRole: (role: UserRole, targetHospitalId?: string) => Promise<void>;
  refreshHospitals: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Only restore from localStorage if a real user was saved. Never default to super_admin!
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('rb_active_user');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}
    return null;
  });

  const [allHospitalsList, setAllHospitalsList] = useState<Hospital[]>([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string | 'all'>(() => {
    return localStorage.getItem('rb_selected_hospital_id') || 'all';
  });
  const [currentHospital, setCurrentHospital] = useState<Hospital | null>(null);

  const isAuthenticated = Boolean(currentUser);
  const role = currentUser?.role || null;
  const isSuperAdmin = role === 'super_admin';
  const isHospitalAdmin = role === 'hospital_admin';
  const isStaff = role === 'staff';

  const refreshHospitals = async () => {
    const list = await db.getHospitals();
    setAllHospitalsList(list);

    if (currentUser) {
      if (!isSuperAdmin && currentUser.hospital_id) {
        // STRICT LOCK: A hospital user can ONLY ever be connected to their own hospital_id
        setSelectedHospitalId(currentUser.hospital_id);
        const match = list.find((h) => h.id === currentUser.hospital_id);
        setCurrentHospital(match || null);
      } else if (isSuperAdmin) {
        if (selectedHospitalId !== 'all') {
          const match = list.find((h) => h.id === selectedHospitalId);
          setCurrentHospital(match || list[0] || null);
        } else {
          setCurrentHospital(list[0] || null);
        }
      }
    } else {
      setCurrentHospital(null);
    }
  };

  useEffect(() => {
    refreshHospitals();
  }, [currentUser, selectedHospitalId]);

  const switchHospital = async (hospitalId: string | 'all') => {
    // Only Super Admin is allowed to switch hospitals
    if (!isSuperAdmin) {
      console.warn('Unauthorized: Hospital users cannot switch hospitals.');
      return;
    }

    setSelectedHospitalId(hospitalId);
    localStorage.setItem('rb_selected_hospital_id', hospitalId);
    if (hospitalId !== 'all') {
      const h = allHospitalsList.find((item) => item.id === hospitalId) || null;
      setCurrentHospital(h);
    }
  };

  const login = async (email: string, password?: string): Promise<boolean> => {
    const users = await db.getUsers();
    const cleanEmail = email.toLowerCase().trim();
    const user = users.find((u) => u.email.toLowerCase().trim() === cleanEmail);
    if (user) {
      if (password && user.password_hash) {
        const storedHash = user.password_hash;
        const matchesPlain = storedHash === password;
        const matchesDemo =
          storedHash.startsWith('$2a$10$DEMO_HASH_') &&
          ((storedHash.includes('SUPER_ADMIN') && (password === 'admin123' || password === 'superadmin123')) ||
           (storedHash.includes('STAFF') && (password === 'staff123' || password === 'admin123')) ||
           password === 'admin123' || password === 'hospital123');

        if (!matchesPlain && !matchesDemo) {
          return false;
        }
      }
      setCurrentUser(user);
      localStorage.setItem('rb_active_user', JSON.stringify(user));
      const hospitals = await db.getHospitals();
      setAllHospitalsList(hospitals);

      if (user.role === 'super_admin') {
        setSelectedHospitalId('all');
        localStorage.setItem('rb_selected_hospital_id', 'all');
      } else if (user.hospital_id) {
        setSelectedHospitalId(user.hospital_id);
        localStorage.setItem('rb_selected_hospital_id', user.hospital_id);
        const h = hospitals.find((item) => item.id === user.hospital_id) || null;
        setCurrentHospital(h);
      }
      return true;
    }
    return false;
  };

  const logout = () => {
    localStorage.removeItem('rb_active_user');
    localStorage.removeItem('rb_selected_hospital_id');
    setCurrentUser(null);
    setCurrentHospital(null);
    setSelectedHospitalId('all');
  };

  const switchUserRole = async (targetRole: UserRole, targetHospitalId?: string) => {
    const users = await db.getUsers();
    let match: User | undefined;

    if (targetRole === 'super_admin') {
      match = users.find((u) => u.role === 'super_admin');
    } else if (targetHospitalId) {
      match = users.find((u) => u.role === targetRole && u.hospital_id === targetHospitalId);
    } else {
      match = users.find((u) => u.role === targetRole);
    }

    if (match) {
      setCurrentUser(match);
      localStorage.setItem('rb_active_user', JSON.stringify(match));
      if (match.role === 'super_admin') {
        setSelectedHospitalId('all');
        localStorage.setItem('rb_selected_hospital_id', 'all');
      } else if (match.hospital_id) {
        setSelectedHospitalId(match.hospital_id);
        localStorage.setItem('rb_selected_hospital_id', match.hospital_id);
        const h = allHospitalsList.find((item) => item.id === match.hospital_id) || null;
        setCurrentHospital(h);
      }
    }
  };

  // If super admin, see all hospitals. If hospital user, see strictly their own hospital.
  const visibleHospitals = isSuperAdmin
    ? allHospitalsList
    : allHospitalsList.filter((h) => h.id === currentUser?.hospital_id);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        currentHospital,
        selectedHospitalId:
          !isSuperAdmin && currentUser?.hospital_id ? currentUser.hospital_id : selectedHospitalId,
        hospitals: visibleHospitals,
        role,
        isSuperAdmin,
        isHospitalAdmin,
        isStaff,
        isAuthenticated,
        login,
        logout,
        switchHospital,
        switchUserRole,
        refreshHospitals,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
