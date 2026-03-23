import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { X, UserPlus, Stethoscope, Phone, User, Clock } from "lucide-react";
import { format } from "date-fns";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Select } from "./ui/select";
import { useCreatePatient } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetPatientsQueryKey } from "@workspace/api-client-react";

const patientSchema = z.object({
  name: z.string().min(1, "Name required").max(100),
  phone: z.string().min(10, "Phone number must be at least 10 digits").max(15),
  disease: z.string().min(1, "Disease/Notes required"),
  age: z.string().optional(),
  gender: z.string().optional(),
});

type PatientFormValues = z.infer<typeof patientSchema>;

interface AddPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDate: string; // DD-MM-YYYY format
}

export function AddPatientModal({ isOpen, onClose, currentDate }: AddPatientModalProps) {
  const queryClient = useQueryClient();
  
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid, isDirty },
  } = useForm<PatientFormValues>({
    resolver: zodResolver(patientSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      phone: "",
      disease: "",
      age: "",
      gender: "",
    }
  });

  const { mutate, isPending } = useCreatePatient({
    mutation: {
      onSuccess: () => {
        // Invalidate the current date's query to refetch
        queryClient.invalidateQueries({ queryKey: getGetPatientsQueryKey({ date: currentDate }) });
        reset();
        onClose();
      },
      onError: (err) => {
        console.error("Failed to create patient:", err);
        alert("Failed to save patient entry. Please try again.");
      }
    }
  });

  const onSubmit = (data: PatientFormValues) => {
    // Inject current date and time
    const currentTime = format(new Date(), 'HH:mm');
    
    mutate({
      data: {
        ...data,
        date: currentDate,
        time: currentTime,
      }
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 sm:px-0">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-foreground/20 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", bounce: 0.3, duration: 0.4 }}
            className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-card shadow-2xl border border-border"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/50 bg-primary/5 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">New Patient Entry</h2>
                  <p className="text-xs font-medium text-primary">Strict Validation Enforced</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="p-6">
              <div className="grid gap-6 sm:grid-cols-2">
                {/* REQUIRED FIELDS */}
                <div className="sm:col-span-2 space-y-5">
                  <div className="relative pb-2">
                    <label className="mb-1.5 block text-sm font-semibold text-foreground flex items-center gap-2">
                      <User className="w-4 h-4 text-primary" /> Patient Name <span className="text-destructive">*</span>
                    </label>
                    <Input
                      {...register("name")}
                      placeholder="e.g. Ramesh Kumar"
                      error={errors.name?.message}
                      autoFocus
                    />
                  </div>

                  <div className="relative pb-2">
                    <label className="mb-1.5 block text-sm font-semibold text-foreground flex items-center gap-2">
                      <Phone className="w-4 h-4 text-primary" /> Phone Number <span className="text-destructive">*</span>
                    </label>
                    <Input
                      {...register("phone")}
                      placeholder="e.g. 9876543210"
                      type="tel"
                      error={errors.phone?.message}
                    />
                  </div>

                  <div className="relative pb-2">
                    <label className="mb-1.5 block text-sm font-semibold text-foreground flex items-center gap-2">
                      <Stethoscope className="w-4 h-4 text-primary" /> Disease / Notes <span className="text-destructive">*</span>
                    </label>
                    <Textarea
                      {...register("disease")}
                      placeholder="Symptoms, diagnosis, or consultation notes..."
                      error={errors.disease?.message}
                    />
                  </div>
                </div>

                {/* OPTIONAL FIELDS */}
                <div className="space-y-1 pb-2">
                  <label className="mb-1.5 block text-sm font-semibold text-muted-foreground">Age (Optional)</label>
                  <Input
                    {...register("age")}
                    placeholder="e.g. 45"
                    type="number"
                    error={errors.age?.message}
                  />
                </div>

                <div className="space-y-1 pb-2">
                  <label className="mb-1.5 block text-sm font-semibold text-muted-foreground">Gender (Optional)</label>
                  <Select {...register("gender")} error={errors.gender?.message}>
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </Select>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="mt-8 flex items-center justify-end gap-3 border-t border-border pt-5">
                <Button type="button" variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={!isDirty || !isValid} 
                  isLoading={isPending}
                  className="min-w-[140px]"
                >
                  Save Entry
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
