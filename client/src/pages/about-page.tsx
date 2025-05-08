import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FolderLock, Shield, Users, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function AboutPage() {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);
  const { toast } = useToast();
  
  const toggleFaq = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };
  
  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Message sent",
      description: "Thank you for your message. We'll get back to you soon.",
    });
    // Reset form
    (e.target as HTMLFormElement).reset();
  };
  
  // FAQ items
  const faqItems = [
    {
      question: "How secure is VaultBox?",
      answer: "VaultBox uses AES-256 encryption, the same standard used by governments and militaries worldwide. Your data is encrypted on your device before being transmitted, ensuring that even we cannot access your information."
    },
    {
      question: "What happens if I lose my password?",
      answer: "If you lose your master password, you can recover access through your designated recovery methods, such as a recovery key or trusted contacts. Without these recovery options, your data may be permanently inaccessible."
    },
    {
      question: "How does emergency access work?",
      answer: "Trusted contacts can request emergency access to your vault. You can set a waiting period during which you'll be notified and can deny the request. After the waiting period expires, your trusted contact will be granted access to the specific items you've designated."
    },
    {
      question: "Is my data backed up?",
      answer: "Yes, your encrypted data is backed up securely. However, since the data is encrypted with your password, without your password or recovery methods, the backups cannot be decrypted."
    },
    {
      question: "Can I access my vault from multiple devices?",
      answer: "Yes, you can access your VaultBox account from any device with a web browser. Your encrypted data is synchronized across all your devices automatically."
    }
  ];

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      
      <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
        <MobileNav />
        
        <div className="p-4 lg:p-8">
          <div className="max-w-4xl mx-auto">
            {/* Hero Section */}
            <div className="text-center mb-12">
              <FolderLock className="h-16 w-16 text-secondary mx-auto mb-4" />
              <h2 className="font-montserrat font-bold text-3xl text-white mb-4">
                Your Life's Critical Information,<br/> Securely Stored
              </h2>
              <p className="text-[#E5E5E5] text-lg max-w-2xl mx-auto">
                VaultBox provides military-grade encryption to protect your most important documents and information, with emergency access for your trusted contacts.
              </p>
            </div>
            
            {/* Security Hero Image */}
            <div className="relative rounded-xl overflow-hidden mb-12 shadow-neumorphic">
              <div className="absolute inset-0 flex items-center justify-center bg-[#1A2342]/70 z-10">
                <div className="text-center">
                  <h3 className="font-montserrat font-bold text-2xl text-white mb-2">Bank-Level Security</h3>
                  <p className="text-[#E5E5E5] max-w-lg">
                    AES-256 encryption keeps your data protected at all times
                  </p>
                </div>
              </div>
              <div className="h-64 bg-gradient-to-br from-[#121829] to-[#263868] flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="h-32 w-32 text-secondary/20">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  <circle cx="12" cy="16" r="1"></circle>
                </svg>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-[#121829] to-transparent"></div>
            </div>
            
            {/* How It Works */}
            <div className="mb-12">
              <h3 className="font-montserrat font-bold text-2xl text-white text-center mb-8">How VaultBox Works</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-primary/40 rounded-xl p-6 shadow-neumorphic text-center">
                  <div className="w-16 h-16 bg-secondary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Shield className="text-secondary text-2xl" />
                  </div>
                  <h4 className="font-montserrat font-medium text-white mb-2">Secure Storage</h4>
                  <p className="text-[#E5E5E5]">
                    Your information is encrypted on your device before being stored in our secure cloud.
                  </p>
                </div>
                
                <div className="bg-primary/40 rounded-xl p-6 shadow-neumorphic text-center">
                  <div className="w-16 h-16 bg-secondary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="text-secondary text-2xl" />
                  </div>
                  <h4 className="font-montserrat font-medium text-white mb-2">Trusted Contacts</h4>
                  <p className="text-[#E5E5E5]">
                    Designate trusted individuals who can access your information in emergencies.
                  </p>
                </div>
                
                <div className="bg-primary/40 rounded-xl p-6 shadow-neumorphic text-center">
                  <div className="w-16 h-16 bg-secondary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Clock className="text-secondary text-2xl" />
                  </div>
                  <h4 className="font-montserrat font-medium text-white mb-2">Emergency Access</h4>
                  <p className="text-[#E5E5E5]">
                    Set custom delays and approval requirements for emergency access requests.
                  </p>
                </div>
              </div>
            </div>
            
            {/* FAQ Section */}
            <div className="mb-12">
              <h3 className="font-montserrat font-bold text-2xl text-white text-center mb-8">Frequently Asked Questions</h3>
              
              <div className="space-y-4">
                {faqItems.map((faq, index) => (
                  <div key={index} className="bg-primary/40 rounded-xl shadow-neumorphic overflow-hidden">
                    <button 
                      className="w-full text-left p-4 flex justify-between items-center focus:outline-none"
                      onClick={() => toggleFaq(index)}
                    >
                      <span className="font-montserrat font-medium text-white">{faq.question}</span>
                      {expandedFaq === index ? (
                        <ChevronUp className="text-secondary h-5 w-5 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="text-secondary h-5 w-5 flex-shrink-0" />
                      )}
                    </button>
                    <div className={`overflow-hidden transition-all duration-300 ${expandedFaq === index ? 'max-h-96' : 'max-h-0'}`}>
                      <div className="p-4 pt-0 text-[#E5E5E5]">
                        <p>{faq.answer}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Contact Section */}
            <div>
              <h3 className="font-montserrat font-bold text-2xl text-white text-center mb-8">Get in Touch</h3>
              
              <div className="bg-primary/40 rounded-xl p-6 shadow-neumorphic">
                <form onSubmit={handleContactSubmit}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input 
                        id="name" 
                        className="bg-[#1E293B]/50 border-primary" 
                        placeholder="Your name"
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input 
                        id="email" 
                        type="email" 
                        className="bg-[#1E293B]/50 border-primary" 
                        placeholder="your@email.com"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="mb-4 space-y-2">
                    <Label htmlFor="message">Message</Label>
                    <Textarea 
                      id="message" 
                      rows={4} 
                      className="bg-[#1E293B]/50 border-primary" 
                      placeholder="Your message"
                      required
                    />
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full bg-secondary hover:bg-secondary/90 text-white font-medium py-3 px-4 rounded-lg shadow-lg hover:shadow-glow transition-all duration-300"
                  >
                    Send Message
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
