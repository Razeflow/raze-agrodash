export type UserRole = "SUPER_ADMIN" | "ADMIN" | "BARANGAY_USER";

export type UserAccount = {
  username: string;
  password: string;
  role: UserRole;
  barangay: string | null; // null for admins (see all)
  displayName: string;
};

export const ACCOUNTS: UserAccount[] = [
  // Super Admin
  { username: "superadmin", password: "admin123", role: "SUPER_ADMIN", barangay: null, displayName: "Super Admin" },
  // Admins
  { username: "admin1", password: "admin123", role: "ADMIN", barangay: null, displayName: "Admin 1" },
  { username: "admin2", password: "admin123", role: "ADMIN", barangay: null, displayName: "Admin 2" },
  // Barangay Users (1 per barangay)
  { username: "supo",      password: "user123", role: "BARANGAY_USER", barangay: "Supo",      displayName: "Supo Officer" },
  { username: "poblacion",  password: "user123", role: "BARANGAY_USER", barangay: "Poblacion",  displayName: "Poblacion Officer" },
  { username: "wayangan",   password: "user123", role: "BARANGAY_USER", barangay: "Wayangan",   displayName: "Wayangan Officer" },
  { username: "kili",       password: "user123", role: "BARANGAY_USER", barangay: "Kili",       displayName: "Kili Officer" },
  { username: "tiempo",     password: "user123", role: "BARANGAY_USER", barangay: "Tiempo",     displayName: "Tiempo Officer" },
  { username: "amtuagan",   password: "user123", role: "BARANGAY_USER", barangay: "Amtuagan",   displayName: "Amtuagan Officer" },
  { username: "tabacda",    password: "user123", role: "BARANGAY_USER", barangay: "Tabacda",    displayName: "Tabacda Officer" },
  { username: "alangtin",   password: "user123", role: "BARANGAY_USER", barangay: "Alangtin",   displayName: "Alangtin Officer" },
  { username: "dilong",     password: "user123", role: "BARANGAY_USER", barangay: "Dilong",     displayName: "Dilong Officer" },
  { username: "tubtuba",    password: "user123", role: "BARANGAY_USER", barangay: "Tubtuba",    displayName: "Tubtuba Officer" },
];
