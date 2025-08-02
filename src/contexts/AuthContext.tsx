import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { AuthContext } from "@/hooks/auth";
import { UserRole } from "@/types/users";

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userRoles, setUserRoles] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Get initial session
    let isMounted = true;
    const initializeAuth = async () => {
      supabase.auth
        .getSession()
        .then(({ data: { session } }) => {
          setSession(session);
          if (session) {
            return supabase
              .from("profiles")
              .select("role")
              .eq("user_id", session.user.id)
              .maybeSingle()
              .then(({ data: userData, error }) => {
                if (error) {
                  console.error("User data fetch error:", error);
                  if (isMounted) setUser(null);
                } else if (userData) {
                  if (isMounted) {
                    setUserRoles(userData?.role);
                    setUser(session?.user);
                  }
                }
              });
          } else {
            console.log("No session found");
            if (isMounted) setUser(null);
            return Promise.resolve();
          }
        })
        .catch((error) => {
          console.error("Auth check error:", error);
          if (isMounted) setUser(null);
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    };

    initializeAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        setSession(session);
        supabase
          .from("profiles")
          .select("role")
          .eq("user_id", session.user.id)
          .maybeSingle()
          .then(({ data: userData, error }) => {
            if (!error && userData && isMounted) {
              setUserRoles(userData?.role);
              setUser(session?.user);
            }
          });
        if (location.pathname === "/auth") {
          navigate("/");
        }
      } else if (event === "SIGNED_OUT" && isMounted) {
        setUser(null);
        navigate("/auth");
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <AuthContext.Provider
      value={{ session, user, userRoles, signOut, loading }}
    >
      {children}
    </AuthContext.Provider>
  );
};
