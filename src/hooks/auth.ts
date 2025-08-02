import { useContext, createContext } from "react";
import { Session, User } from "@supabase/supabase-js";
import { UserRole } from "@/types/users";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  userRoles: UserRole | null;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  userRoles: null,
  signOut: async () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
