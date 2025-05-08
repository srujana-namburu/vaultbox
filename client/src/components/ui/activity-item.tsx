import { ActivityLog } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { 
  FileEdit, 
  UserPlus, 
  Clock, 
  Upload,
  LogIn,
  LogOut,
  Key,
  Shield,
  Trash,
  FilePlus,
  Share,
  AlertTriangle
} from "lucide-react";

interface ActivityItemProps {
  activity: ActivityLog;
}

export function ActivityItem({ activity }: ActivityItemProps) {
  // Convert activity timestamp to relative time
  const getRelativeTime = (timestamp: Date | string) => {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    try {
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (error) {
      return "Invalid date";
    }
  };
  
  // Get icon based on activity action
  const getIcon = () => {
    const iconMap: Record<string, JSX.Element> = {
      entry_created: <FilePlus className="text-secondary" />,
      entry_updated: <FileEdit className="text-secondary" />,
      entry_shared: <Share className="text-secondary" />,
      entry_deleted: <Trash className="text-[#F23557]" />,
      contact_added: <UserPlus className="text-secondary" />,
      contact_updated: <UserPlus className="text-secondary" />,
      contact_deleted: <UserPlus className="text-[#F23557]" />,
      login: <LogIn className="text-secondary" />,
      logout: <LogOut className="text-secondary" />,
      account_created: <Key className="text-secondary" />,
      security_alert: <AlertTriangle className="text-[#F8B400]" />,
      access_timeout: <Clock className="text-[#F8B400]" />,
      document_upload: <Upload className="text-secondary" />,
      security_settings_changed: <Shield className="text-secondary" />
    };
    
    return iconMap[activity.action] || <FileEdit className="text-secondary" />;
  };
  
  return (
    <div className="flex items-start">
      <div className="flex-shrink-0 w-10 h-10 bg-secondary/20 rounded-full flex items-center justify-center">
        {getIcon()}
      </div>
      <div className="ml-4">
        <p className="text-white">{activity.details}</p>
        <p className="text-sm text-gray-400">{getRelativeTime(activity.timestamp)}</p>
      </div>
    </div>
  );
}
