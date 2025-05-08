import { Link } from "wouter";
import { 
  Tickets, 
  CreditCard, 
  Key, 
  HeartPulse,
  File,
  Lock,
  Eye
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { CategoryBadge } from "@/components/ui/category-badge";
import { VaultEntry } from "@shared/schema";
import { useState } from "react";
import { format } from "date-fns";

// Map of category to icon
const categoryIcons: Record<string, JSX.Element> = {
  "personal_documents": <Tickets size={20} />,
  "financial_records": <CreditCard size={20} />,
  "account_credentials": <Key size={20} />,
  "medical_information": <HeartPulse size={20} />,
  "other": <File size={20} />
};

// Props for the EntryCard component
interface EntryCardProps {
  entry: VaultEntry;
}

export function EntryCard({ entry }: EntryCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  // Get category label
  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      "personal_documents": "Personal Documents",
      "financial_records": "Financial Records",
      "account_credentials": "Account Credentials",
      "medical_information": "Medical Information",
      "other": "Other"
    };
    return labels[category] || category;
  };
  
  // Get formatted date
  const getFormattedDate = (date: Date | string | null) => {
    if (!date) return "Never";
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      const now = new Date();
      const diffDays = Math.round((now.getTime() - dateObj.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) return "Today";
      if (diffDays === 1) return "Yesterday";
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} ${Math.floor(diffDays / 7) === 1 ? 'week' : 'weeks'} ago`;
      if (diffDays < 365) return `${Math.floor(diffDays / 30)} ${Math.floor(diffDays / 30) === 1 ? 'month' : 'months'} ago`;
      return format(dateObj, "MMMM d, yyyy");
    } catch (error) {
      return "Invalid date";
    }
  };
  
  // Get the icon for the category
  const getCategoryIcon = () => {
    return categoryIcons[entry.category] || <File size={20} />;
  };
  
  return (
    <div 
      className="bg-primary/40 rounded-xl overflow-hidden shadow-neumorphic hover:shadow-glow transition-all duration-300 group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="p-4 border-b border-[#1E293B] flex justify-between items-center">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-secondary/20 rounded-lg flex items-center justify-center">
            {getCategoryIcon()}
          </div>
          <h3 className="ml-3 font-montserrat font-medium text-white truncate max-w-[150px]">
            {entry.title}
          </h3>
        </div>
        <div>
          <StatusBadge status={entry.status} />
        </div>
      </div>
      
      <div className="p-4">
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-400">Category</span>
            <span className="text-white">
              <CategoryBadge category={entry.category} />
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Updated</span>
            <span className="text-white">{getFormattedDate(entry.updatedAt)}</span>
          </div>
        </div>
        
        {/* Placeholder secure content */}
        <div className="mt-4 relative bg-[#1E293B]/70 rounded-lg overflow-hidden h-36 flex items-center justify-center">
          <Lock size={40} className="text-secondary/70" />
          {isHovered && (
            <div className="absolute inset-0 bg-[#121829]/80 flex items-center justify-center">
              <Link 
                href={`/entry/${entry.id}`}
                className="bg-secondary hover:bg-secondary/90 text-white py-2 px-4 rounded-lg shadow flex items-center space-x-2 transition-all"
              >
                <Eye size={18} />
                <span>View Details</span>
              </Link>
            </div>
          )}
        </div>
        
        <div className="mt-4 flex justify-between">
          <span className="text-xs text-gray-400">
            Created: {getFormattedDate(entry.createdAt)}
          </span>
          <Link 
            href={`/entry/${entry.id}`}
            className="text-secondary hover:text-white transition-colors"
          >
            <Eye size={16} className="inline mr-1" /> View
          </Link>
        </div>
      </div>
    </div>
  );
}
