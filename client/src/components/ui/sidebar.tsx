import { Fragment, useEffect, useState, useRef } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { 
  Home,
  FolderLock,
  UserCheck,
  Clock,
  Settings,
  LogOut,
  ShieldCheck,
  Bell
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { SlidingNumber } from "./sliding-number";

export function Sidebar() {
  const [location, navigate] = useLocation();
  const { user, logoutMutation } = useAuth();
  const [timer, setTimer] = useState(30 * 60); // 30 minutes in seconds
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const initializedRef = useRef(false);

  // Only initialize timer once per session (not on every mount)
  useEffect(() => {
    if (!initializedRef.current) {
      const storedStart = localStorage.getItem('sessionTimerStart');
      const storedTimeout = localStorage.getItem('sessionTimeoutMinutes');
      const timeoutMinutes = storedTimeout ? parseInt(storedTimeout, 10) : 30;
      if (storedStart) {
        const elapsed = Math.floor((Date.now() - parseInt(storedStart, 10)) / 1000);
        setTimer(Math.max(0, timeoutMinutes * 60 - elapsed));
      } else {
        setTimer(timeoutMinutes * 60);
      }
      initializedRef.current = true;
    }
  }, []);

  // On login, reset timer and set new start time
  useEffect(() => {
    if (user) {
      const now = Date.now();
      const storedTimeout = localStorage.getItem('sessionTimeoutMinutes');
      const timeoutMinutes = storedTimeout ? parseInt(storedTimeout, 10) : 30;
      localStorage.setItem('sessionTimerStart', now.toString());
      setTimer(timeoutMinutes * 60);
    }
  }, [user]);

  // Countdown effect
  useEffect(() => {
    if (timer <= 0) {
      logoutMutation.mutate();
      localStorage.removeItem('sessionTimerStart');
      setTimeout(() => navigate('/auth'), 500); // force redirect to sign-in page
      return;
    }
    timerRef.current = setTimeout(() => setTimer(t => t - 1), 1000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [timer, logoutMutation, navigate]);
  
  const handleLogout = () => {
    logoutMutation.mutate();
  };
  
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase();
  };
  
  const navItems = [
    { icon: <Home size={20} />, label: "Dashboard", path: "/" },
    { icon: <FolderLock size={20} />, label: "My Vault", path: "/vault" },
    { icon: <UserCheck size={20} />, label: "Trusted Contacts", path: "/trusted-contacts" },
    { icon: <Clock size={20} />, label: "Activity Log", path: "/activity" },
    { icon: <Settings size={20} />, label: "Settings", path: "/settings" },
    { icon: <ShieldCheck size={20} />, label: "About", path: "/about" }
  ];

  // Remove formatTime and use SlidingNumber for timer display
  const minutes = Math.floor(timer / 60);
  const seconds = timer % 60;

  return (
    <aside className="hidden lg:flex lg:flex-col w-64 bg-primary/70 backdrop-blur-md shadow-neumorphic h-screen">
      <div className="p-4">
        <h1 className="font-montserrat font-bold text-2xl text-white flex items-center">
          <span className="text-secondary mr-2">
            <FolderLock className="inline-block" />
          </span>
          VaultBox
        </h1>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-4">
        <div className="space-y-1">
          {navItems.map((item) => (
            <Link 
              key={item.path} 
              href={item.path}
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
      {user && (
        <div className="p-4">
          <div className="mb-2 flex justify-center">
            <div className="border-2 border-red-500 bg-red-900/20 rounded-xl px-4 py-2 text-xs text-red-400 font-mono flex items-center gap-1 shadow-glow">
              Session Timeout:
              <span className="text-red-300 font-bold flex items-center gap-1">
                <SlidingNumber value={minutes} padStart />:<SlidingNumber value={seconds} padStart />
              </span>
            </div>
          </div>
          <Separator className="mb-2 bg-[#1E293B]" />
          <div className="flex items-center p-3 bg-[#1E293B]/70 rounded-lg">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-secondary/20 text-secondary">
                {getInitials(user.fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="ml-3 overflow-hidden">
              <p className="text-sm font-medium text-white truncate">{user.fullName}</p>
              <p className="text-xs text-gray-400 truncate">{user.username}</p>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="ml-auto text-gray-400 hover:text-secondary"
              onClick={handleLogout}
              disabled={logoutMutation.isPending}
            >
              <LogOut size={18} />
            </Button>
          </div>
        </div>
      )}
    </aside>
  );
}
