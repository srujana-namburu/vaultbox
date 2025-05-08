import { TrustedContact } from "@shared/schema";
import { 
  User, 
  CheckCircle, 
  Clock, 
  XCircle,
  Trash
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useState } from "react";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface TrustedContactItemProps {
  contact: TrustedContact;
}

export function TrustedContactItem({ contact }: TrustedContactItemProps) {
  const [openDelete, setOpenDelete] = useState(false);
  const { toast } = useToast();
  
  // Get status indicator
  const getStatusIndicator = () => {
    const statusConfig = {
      active: { 
        icon: <CheckCircle size={14} />, 
        label: "Active",
        color: "bg-secondary/20 text-secondary"
      },
      pending: { 
        icon: <Clock size={14} />, 
        label: "Pending",
        color: "bg-[#F8B400]/20 text-[#F8B400]"
      },
      declined: { 
        icon: <XCircle size={14} />, 
        label: "Declined",
        color: "bg-[#F23557]/20 text-[#F23557]"
      }
    };
    
    const config = statusConfig[contact.status as keyof typeof statusConfig] || statusConfig.pending;
    
    return (
      <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${config.color}`}>
        {config.icon}
        <span className="ml-1">{config.label}</span>
      </span>
    );
  };
  
  // Get initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase();
  };
  
  // Delete contact mutation
  const deleteContactMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/trusted-contacts/${contact.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trusted-contacts"] });
      toast({
        title: "Contact removed",
        description: `${contact.name} has been removed from your trusted contacts.`
      });
      setOpenDelete(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error removing contact",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  return (
    <div className="flex items-center">
      <Avatar className="h-10 w-10">
        <AvatarFallback className="bg-secondary/20 text-secondary">
          {getInitials(contact.name)}
        </AvatarFallback>
      </Avatar>
      <div className="ml-3">
        <p className="text-white">{contact.name}</p>
        <p className="text-xs text-gray-400">{contact.accessLevel.replace('_', ' ')}</p>
      </div>
      <div className="ml-auto flex items-center">
        {getStatusIndicator()}
        
        <AlertDialog open={openDelete} onOpenChange={setOpenDelete}>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="ml-2 text-gray-400 hover:text-[#F23557]">
              <Trash size={16} />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="bg-[#1A2342] border-[#1E293B]">
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Trusted Contact</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove {contact.name} from your trusted contacts?
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={(e) => {
                  e.preventDefault();
                  deleteContactMutation.mutate();
                }}
                className="bg-[#F23557] hover:bg-[#F23557]/90"
              >
                {deleteContactMutation.isPending ? "Removing..." : "Remove"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
