import { 
  Tickets, 
  CreditCard, 
  Key, 
  HeartPulse,
  File
} from "lucide-react";

interface CategoryBadgeProps {
  category: string;
}

export function CategoryBadge({ category }: CategoryBadgeProps) {
  // Map of category to icon and label
  const categoryInfo: Record<string, { icon: JSX.Element, label: string, color: string }> = {
    "personal_documents": { 
      icon: <Tickets size={14} />, 
      label: "Personal", 
      color: "bg-blue-600/20 text-blue-400"
    },
    "financial_records": { 
      icon: <CreditCard size={14} />, 
      label: "Financial", 
      color: "bg-green-600/20 text-green-400"
    },
    "account_credentials": { 
      icon: <Key size={14} />, 
      label: "Credentials", 
      color: "bg-purple-600/20 text-purple-400"
    },
    "medical_information": { 
      icon: <HeartPulse size={14} />, 
      label: "Medical", 
      color: "bg-red-600/20 text-red-400"
    },
    "other": { 
      icon: <File size={14} />, 
      label: "Other", 
      color: "bg-gray-600/20 text-gray-400"
    }
  };
  
  const { icon, label, color } = categoryInfo[category] || categoryInfo.other;
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${color}`}>
      {icon}
      {label}
    </span>
  );
}
