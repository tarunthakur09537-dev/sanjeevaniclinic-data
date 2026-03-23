import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { format, parse, parseISO } from "date-fns";
import { 
  Search, Calendar, LogOut, Plus, FileSpreadsheet, 
  Printer, Activity, Users, Clock, AlertCircle, FileX
} from "lucide-react";
import { motion } from "framer-motion";

import { checkAuth, setAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddPatientModal } from "@/components/AddPatientModal";
import { useGetPatients } from "@workspace/api-client-react";
import logoImg from "@assets/f95PPS2Ez4GahpGBgoyqp57A97Ul9Qywyu0lPLqY_1774239437926.png";

export default function Dashboard() {
  const [_, setLocation] = useLocation();
  
  // Auth Check
  useEffect(() => {
    if (!checkAuth()) {
      setLocation("/");
    }
  }, [setLocation]);

  // State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Date handling: HTML input needs YYYY-MM-DD, API needs DD-MM-YYYY
  const todayHtml = format(new Date(), 'yyyy-MM-dd');
  const [selectedHtmlDate, setSelectedHtmlDate] = useState(todayHtml);
  
  const apiDateString = useMemo(() => {
    return format(parseISO(selectedHtmlDate), 'dd-MM-yyyy');
  }, [selectedHtmlDate]);

  const displayDateString = useMemo(() => {
    return format(parseISO(selectedHtmlDate), 'd MMMM, yyyy');
  }, [selectedHtmlDate]);

  // Fetch Data
  const { data: patients, isLoading, isError } = useGetPatients({ date: apiDateString });

  // Client-side filtering
  const filteredPatients = useMemo(() => {
    if (!patients) return [];
    if (!searchQuery.trim()) return patients;
    
    const lowerQ = searchQuery.toLowerCase();
    return patients.filter(p => 
      p.name.toLowerCase().includes(lowerQ) || 
      p.phone.includes(lowerQ)
    );
  }, [patients, searchQuery]);

  // Actions
  const handleLogout = () => {
    setAuth(false);
    setLocation("/");
  };

  const handleExportCSV = () => {
    if (!filteredPatients.length) return;
    
    const headers = ['ID', 'Name', 'Phone', 'Disease/Notes', 'Age', 'Gender', 'Time'];
    const rows = filteredPatients.map(p => [
      p.patient_id, 
      `"${p.name}"`, 
      p.phone, 
      `"${p.disease.replace(/"/g, '""')}"`, 
      p.age || '-', 
      p.gender || '-', 
      p.time
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Sanjeevani_Patients_${apiDateString}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  // Render components
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* HEADER (No print) */}
      <header className="no-print sticky top-0 z-30 w-full border-b border-border/50 bg-white/80 backdrop-blur-md shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={logoImg} alt="Logo" className="h-12 w-auto object-contain" />
            <div>
              <h1 className="font-display text-xl font-bold text-foreground">Sanjeevani Clinic</h1>
              <p className="text-xs font-medium text-primary flex items-center gap-1">
                <Activity className="w-3 h-3" /> Live Patient Registry
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-secondary rounded-full border border-border">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">{displayDateString}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-destructive">
              <LogOut className="w-4 h-4 mr-2" /> Logout
            </Button>
          </div>
        </div>
      </header>

      {/* PRINT HEADER (Only visible when printing) */}
      <div className="print-only hidden py-6 border-b-2 border-primary mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Sanjeevani Clinic</h1>
            <p className="text-gray-600 mt-1">Patient Registry</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold">{displayDateString}</p>
            <p className="text-gray-600 mt-1">Total: {filteredPatients?.length || 0}</p>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full print-expand">
        
        {/* TOP CONTROLS (No print) */}
        <div className="no-print flex flex-col md:flex-row gap-6 mb-8 items-start md:items-center justify-between">
          
          <div className="flex items-center gap-6 w-full md:w-auto">
            {/* Stats Card */}
            <div className="flex items-center gap-4 bg-primary text-primary-foreground px-6 py-4 rounded-2xl shadow-lg shadow-primary/20 shrink-0">
              <div className="bg-white/20 p-3 rounded-xl">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-primary-light uppercase tracking-wider">Today's Total</p>
                <p className="text-3xl font-bold leading-none mt-1">
                  {isLoading ? "-" : patients?.length || 0}
                </p>
              </div>
            </div>

            <Button 
              size="lg" 
              className="w-full md:w-auto text-base gap-2 rounded-2xl bg-foreground text-background hover:bg-foreground/90 shadow-xl shadow-black/10"
              onClick={() => setIsModalOpen(true)}
            >
              <Plus className="w-5 h-5" /> Add Patient
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            {/* Tools */}
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" className="flex-1 sm:flex-none bg-white" onClick={handleExportCSV}>
                <FileSpreadsheet className="w-4 h-4 mr-2" /> CSV
              </Button>
              <Button variant="outline" className="flex-1 sm:flex-none bg-white" onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-2" /> Print
              </Button>
            </div>
          </div>
        </div>

        {/* FILTERS (No print) */}
        <div className="no-print bg-white p-4 rounded-2xl border border-border shadow-sm mb-6 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground" />
            <Input 
              placeholder="Search by name or phone number..." 
              className="pl-11 bg-secondary/50 border-transparent h-12"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="relative shrink-0">
            <input 
              type="date" 
              value={selectedHtmlDate}
              onChange={(e) => setSelectedHtmlDate(e.target.value)}
              className="flex h-12 w-full sm:w-48 rounded-xl border-transparent bg-secondary/50 px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* TABLE CONTENT */}
        <div className="bg-white rounded-3xl border border-border shadow-sm overflow-hidden print-expand">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-secondary/60 text-secondary-foreground border-b border-border">
                  <th className="font-semibold text-sm py-4 px-6 w-20">ID</th>
                  <th className="font-semibold text-sm py-4 px-6 w-1/4">Patient Name</th>
                  <th className="font-semibold text-sm py-4 px-6 w-40">Phone</th>
                  <th className="font-semibold text-sm py-4 px-6">Disease / Notes</th>
                  <th className="font-semibold text-sm py-4 px-6 w-24">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 text-foreground">
                
                {isLoading && (
                  <tr>
                    <td colSpan={5} className="py-20 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center">
                        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                        <p>Loading records for {displayDateString}...</p>
                      </div>
                    </td>
                  </tr>
                )}

                {isError && (
                  <tr>
                    <td colSpan={5} className="py-20 text-center text-destructive">
                      <div className="flex flex-col items-center justify-center">
                        <AlertCircle className="h-10 w-10 mb-4 opacity-50" />
                        <p className="font-semibold">Failed to load patient data.</p>
                        <p className="text-sm opacity-80 mt-1">Check your API connection or try again.</p>
                      </div>
                    </td>
                  </tr>
                )}

                {!isLoading && !isError && filteredPatients.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-24 text-center">
                      <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                        <div className="h-20 w-20 bg-secondary rounded-full flex items-center justify-center mb-6">
                          <FileX className="h-10 w-10 text-muted-foreground/50" />
                        </div>
                        <h3 className="text-lg font-bold text-foreground">No patients found</h3>
                        <p className="text-muted-foreground mt-2 text-sm">
                          {searchQuery 
                            ? `No results matching "${searchQuery}" for ${displayDateString}.` 
                            : `There are no patient records added on ${displayDateString} yet.`}
                        </p>
                        {!searchQuery && selectedHtmlDate === todayHtml && (
                          <Button className="mt-6" onClick={() => setIsModalOpen(true)}>
                            Add First Patient
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}

                {!isLoading && !isError && filteredPatients.map((patient, idx) => (
                  <motion.tr 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05, duration: 0.2 }}
                    key={patient.id} 
                    className="hover:bg-primary/5 transition-colors group"
                  >
                    <td className="py-4 px-6 text-sm font-bold text-muted-foreground group-hover:text-primary transition-colors">
                      {patient.patient_id}
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-semibold text-foreground">{patient.name}</div>
                      {(patient.age || patient.gender) && (
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                          {patient.age && <span>{patient.age} yrs</span>}
                          {patient.age && patient.gender && <span className="w-1 h-1 bg-border rounded-full"></span>}
                          {patient.gender && <span>{patient.gender}</span>}
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-6 text-sm font-medium">
                      {patient.phone}
                    </td>
                    <td className="py-4 px-6">
                      <p className="text-sm text-foreground line-clamp-2 max-w-md">
                        {patient.disease}
                      </p>
                    </td>
                    <td className="py-4 px-6">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground text-xs font-bold">
                        <Clock className="w-3 h-3" />
                        {patient.time}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Modals */}
      <AddPatientModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        currentDate={apiDateString}
      />
    </div>
  );
}
