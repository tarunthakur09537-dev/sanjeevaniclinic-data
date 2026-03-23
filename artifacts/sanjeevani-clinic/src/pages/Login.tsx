import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { HeartPulse, Lock, User, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setAuth } from "@/lib/auth";

// Import logo using Vite alias as requested
import logoImg from "@assets/f95PPS2Ez4GahpGBgoyqp57A97Ul9Qywyu0lPLqY_1774239437926.png";

export default function Login() {
  const [_, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(false);
    
    // Simulate network delay for UX
    await new Promise(r => setTimeout(r, 600));
    
    if (username === "sanjeevanientry" && password === "Sanjeevani@87") {
      setAuth(true);
      setLocation("/dashboard");
    } else {
      setError(true);
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-secondary">
      {/* Background Decor */}
      <img 
        src={`${import.meta.env.BASE_URL}images/auth-bg.png`} 
        alt="Clinic Background" 
        className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-overlay pointer-events-none"
      />
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/10 via-transparent to-primary/5 pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md px-4"
      >
        <div className="glass-card rounded-[2rem] p-8 sm:p-10 shadow-2xl border-white">
          
          <div className="flex flex-col items-center text-center mb-10">
            <div className="h-20 w-20 mb-4 rounded-2xl bg-white shadow-md p-2 flex items-center justify-center overflow-hidden ring-4 ring-primary/10">
              <img src={logoImg} alt="Sanjeevani Clinic" className="w-full h-auto object-contain" />
            </div>
            <h1 className="font-display text-3xl font-extrabold text-foreground tracking-tight">
              Sanjeevani Clinic
            </h1>
            <p className="text-muted-foreground mt-2 font-medium">Daily Patient Entry System</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground">
                  <User className="h-5 w-5" />
                </div>
                <Input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-11 h-14 bg-secondary/50 border-transparent focus:bg-white"
                  required
                />
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground">
                  <Lock className="h-5 w-5" />
                </div>
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-11 h-14 bg-secondary/50 border-transparent focus:bg-white"
                  required
                />
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 text-destructive bg-destructive/10 p-3 rounded-xl text-sm font-medium"
                >
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>Invalid username or password.</span>
                </motion.div>
              )}
            </AnimatePresence>

            <Button 
              type="submit" 
              size="lg" 
              className="w-full h-14 text-lg mt-4 shadow-primary/30"
              isLoading={isLoading}
            >
              Secure Login
            </Button>
          </form>

          <div className="mt-8 flex items-center justify-center gap-2 text-xs font-semibold text-muted-foreground">
            <HeartPulse className="h-4 w-4 text-primary" />
            <span>Authorized Reception Personnel Only</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// Temporary workaround for missing AnimatePresence in current context
import { AnimatePresence as FramerAnimatePresence } from "framer-motion";
const AnimatePresence = FramerAnimatePresence;
