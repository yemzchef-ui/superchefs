import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Boxes,
  Truck,
  Utensils,
  Users,
  Building2,
  NotebookPen,
  HandCoins,
  ScrollText,
  PackageSearch,
  DollarSign,
  Settings as Settings,
  Shield,
  X,
  PackageMinusIcon,
  HandshakeIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/auth";
import { UserRole } from "@/types/users";

enum PossibleUserRole {
  admin = "admin",
  manager = "manager",
  staff = "staff",
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const { userRoles } = useAuth();
  const isAdmin = Array.isArray(userRoles)
    ? userRoles?.includes("admin")
    : userRoles === (PossibleUserRole.admin as unknown as UserRole);
  const isManager = Array.isArray(userRoles)
    ? userRoles.includes("manager")
    : userRoles === (PossibleUserRole.manager as unknown as UserRole);
  // const isSuperAdmin = userRoles.includes("super-admin");
  // const isAreaManager = userRoles.includes("area-manager");

  const navigation = [
    {
      name: "Dashboard",
      href: "/",
      icon: LayoutDashboard,
    },
    {
      name: "Materials",
      href: "/inventory",
      icon: Package,
    },
    {
      name: "Products",
      href: "/products",
      icon: PackageSearch,
    },
    {
      name: "Sales",
      href: "/sales",
      icon: ShoppingCart,
    },
    {
      name: "Material Request",
      href: "/material-request",
      icon: Truck,
      managerOnly: true,
    },
    {
      name: "Imprest",
      href: "/imprest-request",
      icon: HandCoins,
      managerOnly: true,
    },
    {
      name: "Procurement",
      href: "/procurement",
      icon: Boxes,
      adminOnly: true,
    },
    {
      name: "Imprest Mngt.",
      href: "/manage-imprest",
      icon: HandshakeIcon,
      adminOnly: true,
    },
    {
      name: "Imprest Mngt.",
      href: "/manage-imprest",
      icon: HandshakeIcon,
      managerOnly: true,
    },
    {
      name: "Damages",
      href: "/damages",
      icon: PackageMinusIcon,
    },
    {
      name: "Accounts",
      href: "/accounts",
      icon: DollarSign,
      adminOnly: true,
    },
    {
      name: "Users",
      href: "/users",
      icon: Users,
      adminOnly: true,
    },
    {
      name: "Branches",
      href: "/branches",
      icon: Building2,
      adminOnly: true,
    },
    {
      name: "Production",
      href: "/production",
      icon: Utensils,
    },
    {
      name: "Records",
      href: "/Records",
      icon: NotebookPen,
      adminOnly: true,
    },
    {
      name: "Records",
      href: "/Records",
      icon: NotebookPen,
      managerOnly: true,
    },
    {
      name: "Recipes",
      href: "/recipes",
      icon: ScrollText,
      adminOnly: true,
    },
    {
      name: "Admin",
      href: "/admin",
      icon: Shield,
      adminOnly: true,
    },
  ];

  return (
    <div
      className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      }`}
      style={{
        backgroundImage: 'url("/bg-green2.jpg")',
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="space-y-4 py-4 h-full shadow-lg overflow-y-auto">
        <div className="flex items-center justify-between px-3">
          <img
            src="/superchefs-logo.png"
            style={{ width: "40px", height: "50px" }}
          />
          <Button variant="secondary" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="px-3 py-2">
          <div className="space-y-3">
            {navigation.map((item) => {
              // Check if the user has the required role for the item
              if (
                item.adminOnly && !isAdmin ||
                item.managerOnly && !isManager
              ) {
                return null;
              }
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  onClick={() => onClose()}
                  className={({ isActive }) =>
                    `flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 hover:bg-accent hover:text-accent-foreground transform hover:translate-x-1 ${
                      isActive ? "bg-accent translate-x-1" : "translate-x-0"
                    }`
                  }
                >
                  <item.icon className="mr-3 h-4 w-4" />
                  {item.name}
                </NavLink>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
