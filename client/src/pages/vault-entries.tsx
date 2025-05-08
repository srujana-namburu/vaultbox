import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { EntryCard } from "@/components/ui/entry-card";
import { Loader2, Plus, Search, Tickets, CreditCard, Key, HeartPulse, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VaultEntry } from "@shared/schema";

export default function VaultEntries() {
  const [location, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  
  // Parse category from URL if present
  useEffect(() => {
    const params = new URLSearchParams(location.split("?")[1]);
    const category = params.get("category");
    if (category) {
      setActiveCategory(category);
    }
  }, [location]);
  
  // Define category list
  const categories = [
    { id: "all", label: "All Entries", icon: <Briefcase size={16} /> },
    { id: "personal_documents", label: "Personal Documents", icon: <Tickets size={16} /> },
    { id: "financial_records", label: "Financial Records", icon: <CreditCard size={16} /> },
    { id: "account_credentials", label: "Account Credentials", icon: <Key size={16} /> },
    { id: "medical_information", label: "Medical Information", icon: <HeartPulse size={16} /> }
  ];
  
  // Fetch vault entries
  const { 
    data: vaultEntries,
    isLoading
  } = useQuery<VaultEntry[]>({
    queryKey: ["/api/vault-entries"],
  });
  
  // Filter entries by category and search term
  const filteredEntries = vaultEntries?.filter(entry => {
    const matchesCategory = !activeCategory || activeCategory === "all" || entry.category === activeCategory;
    const matchesSearch = !searchTerm || 
      entry.title.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesCategory && matchesSearch;
  });
  
  // Set active category and update URL
  const handleCategoryChange = (categoryId: string) => {
    if (categoryId === "all") {
      setActiveCategory(null);
      setLocation("/vault");
    } else {
      setActiveCategory(categoryId);
      setLocation(`/vault?category=${categoryId}`);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      
      <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
        <MobileNav />
        
        <div className="p-4 lg:p-8">
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
            <div>
              <h2 className="font-montserrat font-bold text-2xl text-white">My Vault</h2>
              <p className="text-[#E5E5E5]">Manage your secure documents and information</p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 mt-4 lg:mt-0">
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Search entries..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 bg-[#1E293B]/50 border-primary"
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              </div>
              
              <Link href="/new-entry">
                <Button className="bg-secondary hover:bg-secondary/90 text-white shadow-neumorphic hover:shadow-glow flex items-center justify-center">
                  <Plus className="mr-2 h-4 w-4" />
                  New Entry
                </Button>
              </Link>
            </div>
          </div>
          
          {/* Category Filter Tabs */}
          <div className="flex flex-wrap gap-2 mb-6 overflow-x-auto pb-2">
            {categories.map((category) => (
              <Button
                key={category.id}
                variant={(!activeCategory && category.id === 'all') || activeCategory === category.id ? "default" : "outline"}
                className={`flex items-center ${(!activeCategory && category.id === 'all') || activeCategory === category.id ? 
                  'bg-secondary text-white' : 
                  'bg-primary/40 hover:bg-secondary/20 text-[#E5E5E5]'}`}
                onClick={() => handleCategoryChange(category.id)}
              >
                <span className="mr-2">{category.icon}</span>
                {category.label}
              </Button>
            ))}
          </div>
          
          {/* Vault Entries Grid */}
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="flex flex-col items-center">
                <Loader2 className="h-10 w-10 animate-spin text-secondary mb-4" />
                <p className="text-[#E5E5E5]">Loading your secure vault entries...</p>
              </div>
            </div>
          ) : filteredEntries && filteredEntries.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredEntries.map((entry) => (
                <EntryCard key={entry.id} entry={entry} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="bg-primary/30 rounded-xl p-8 max-w-md mx-auto">
                <div className="w-16 h-16 bg-secondary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  {activeCategory && categories.find(c => c.id === activeCategory)?.icon || 
                    <Briefcase size={24} className="text-secondary" />}
                </div>
                <h3 className="text-xl font-montserrat font-bold mb-2">No entries found</h3>
                <p className="text-[#E5E5E5] mb-6">
                  {searchTerm ? 
                    `No entries match your search for "${searchTerm}"` : 
                    activeCategory ? 
                      `You don't have any entries in the ${categories.find(c => c.id === activeCategory)?.label} category yet.` :
                      "You don't have any vault entries yet. Create your first one to get started!"
                  }
                </p>
                <Link href="/new-entry">
                  <Button className="bg-secondary hover:bg-secondary/90 text-white">
                    <Plus className="mr-2 h-4 w-4" />
                    Create New Entry
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
