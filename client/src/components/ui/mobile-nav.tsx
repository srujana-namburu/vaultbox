import { useState } from "react";
import { useLocation, Link } from "wouter";
import { 
  Home,
  FolderLock,
  UserCheck,
  Info,
  Plus,
  Menu,
  X,
  ShieldCheck,
  Clock,
  Settings,
  Bell
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { NotificationCenter } from "@/components/notifications/notification-center";

export function MobileNav() {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  const [open, setOpen] = useState(false);
  
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase();
  };
  
  const handleLogout = () => {
    logoutMutation.mutate();
    setOpen(false);
  };
  
  // Mobile bottom navigation items
  const bottomNavItems = [
    { icon: <Home size={20} />, label: "Home", path: "/" },
    { icon: <FolderLock size={20} />, label: "Vault", path: "/vault" },
    { icon: <Plus size={24} />, label: "Add", path: "/new-entry", primary: true },
    { icon: <UserCheck size={20} />, label: "Contacts", path: "/trusted-contacts" },
    { icon: <ShieldCheck size={20} />, label: "About", path: "/about" }
  ];
  
  // Sidebar navigation items
  const sidebarNavItems = [
    { icon: <Home size={20} />, label: "Dashboard", path: "/" },
    { icon: <FolderLock size={20} />, label: "My Vault", path: "/vault" },
    { icon: <UserCheck size={20} />, label: "Trusted Contacts", path: "/trusted-contacts" },
    { icon: <Clock size={20} />, label: "Activity Log", path: "/activity" },
    { icon: <Settings size={20} />, label: "Settings", path: "/settings" },
    { icon: <ShieldCheck size={20} />, label: "About", path: "/about" }
  ];

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-primary/90 backdrop-blur-md z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="font-montserrat font-bold text-xl text-white flex items-center">
            <span className="text-secondary mr-2">
              <FolderLock className="inline-block" />
            </span>
            VaultBox
          </h1>
          
          <div className="flex items-center gap-1">
            <NotificationCenter />
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-white">
                  <Menu size={24} />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="bg-[#1A2342] border-r border-[#1E293B] p-0">
                <div className="flex flex-col h-full">
                  <div className="p-4 flex justify-between items-center">
                    <h2 className="font-montserrat font-bold text-xl text-white flex items-center">
                      <span className="text-secondary mr-2">
                        <FolderLock className="inline-block" />
                      </span>
                      VaultBox
                    </h2>
                    <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                      <X className="h-6 w-6 text-gray-400" />
                    </Button>
                  </div>
                  
                  {user && (
                    <div className="p-4 mb-4 border-b border-[#1E293B]">
                      <div className="flex items-center">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-secondary/20 text-secondary">
                            {getInitials(user.fullName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-white">{user.fullName}</p>
                          <p className="text-xs text-gray-400">{user.username}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <nav className="flex-1 overflow-y-auto">
                    <div className="px-2 py-4 space-y-1">
                      {sidebarNavItems.map((item) => (
                        <Link 
                          key={item.path} 
                          href={item.path}
                          onClick={() => setOpen(false)}
                          className={`flex items-center px-4 py-3 rounded-lg group transition-all ${
                            location === item.path 
                              ? "text-white bg-secondary/20" 
                              : "text-[#E5E5E5] hover:text-white hover:bg-secondary/10"
                          }`}
                        >
                          <span className={`mr-3 ${location === item.path ? "text-secondary" : "group-hover:text-secondary"}`}>
                            {item.icon}
                          </span>
                          <span>{item.label}</span>
                        </Link>
                      ))}
                    </div>
                  </nav>
                  
                  <div className="p-4 border-t border-[#1E293B]">
                    <Button 
                      variant="destructive" 
                      className="w-full"
                      onClick={handleLogout}
                      disabled={logoutMutation.isPending}
                    >
                      Logout
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
      
      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-primary/90 backdrop-blur-md border-t border-[#1E293B] z-10">
        <div className="flex justify-around px-4 py-2">
          {bottomNavItems.map((item) => (
            <Link 
              key={item.path} 
              href={item.path}
              className="flex flex-col items-center py-1"
            >
              {item.primary ? (
                <div className="bg-secondary rounded-full p-3 -mt-8 shadow-glow">
                  {item.icon}
                </div>
              ) : (
                <div className={`p-2 ${location === item.path ? "text-secondary" : "text-gray-400 hover:text-secondary"}`}>
                  {item.icon}
                </div>
              )}
              <span className={`text-xs mt-1 ${location === item.path ? "text-secondary" : "text-gray-400"}`}>
                {item.label}
              </span>
            </Link>
          ))}
        </div>
      </div>
      
      {/* Padding for mobile content */}
      <div className="lg:hidden pt-14 pb-16"></div>
    </>
  );
}