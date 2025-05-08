import { createContext, ReactNode, useContext } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ActivityLog } from "@/lib/types";
import { getQueryFn } from "../lib/queryClient";

type ActivityLogContextType = {
  activityLogs: ActivityLog[];
  isLoading: boolean;
  error: Error | null;
  refreshActivityLogs: () => void;
};

const ActivityLogContext = createContext<ActivityLogContextType | null>(null);

export function ActivityLogProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  
  const {
    data: activityLogs = [],
    error,
    isLoading,
  } = useQuery<ActivityLog[], Error>({
    queryKey: ["/api/activity-logs"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const refreshActivityLogs = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/activity-logs"] });
  };

  return (
    <ActivityLogContext.Provider
      value={{
        activityLogs,
        isLoading,
        error,
        refreshActivityLogs,
      }}
    >
      {children}
    </ActivityLogContext.Provider>
  );
}

export function useActivityLog() {
  const context = useContext(ActivityLogContext);
  if (!context) {
    throw new Error("useActivityLog must be used within an ActivityLogProvider");
  }
  return context;
}