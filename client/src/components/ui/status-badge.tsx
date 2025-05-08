import { 
  CheckCircle, 
  AlertCircle, 
  Share2, 
  Clock
} from "lucide-react";

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  // Map of status to icon, label, and color
  const statusInfo: Record<string, { icon: JSX.Element, color: string }> = {
    "active": { 
      icon: <CheckCircle size={14} />, 
      color: "bg-secondary/20 text-secondary"
    },
    "shared": { 
      icon: <Share2 size={14} />, 
      color: "bg-[#F8B400]/20 text-[#F8B400]"
    },
    "expiring": { 
      icon: <Clock size={14} />, 
      color: "bg-[#F8B400]/20 text-[#F8B400]"
    },
    "locked": { 
      icon: <AlertCircle size={14} />, 
      color: "bg-[#F23557]/20 text-[#F23557]"
    }
  };
  
  const { icon, color } = statusInfo[status] || statusInfo.active;
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${color}`}>
      {icon}
      <span className="capitalize">{status}</span>
    </span>
  );
}
