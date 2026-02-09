// ==========================================
// PERSON EDIT FORM - Reusable person editor
// ==========================================

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { Person } from "@/lib/types";
import { supabase } from "@/lib/supabaseClient";

interface PersonEditFormProps {
  person: Person;
  onSuccess: () => void;
  onCancel?: () => void;
}

export function PersonEditForm({ person, onSuccess, onCancel }: PersonEditFormProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  
  const [name, setName] = useState(person.full_name);
  const [email, setEmail] = useState(person.email);

  const handleSubmit = async () => {
    setMessage(null);
    setLoading(true);

    const { error } = await supabase
      .from("people")
      .update({ 
        full_name: name,
        email: email.toLowerCase()
      })
      .eq("id", person.id);

    setLoading(false);

    if (error) {
      setMessage("Error: " + error.message);
      return;
    }

    onSuccess();
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Full Name</Label>
        <Input 
          value={name} 
          onChange={(e) => setName(e.target.value)}
          disabled={loading}
        />
      </div>
      
      <div className="space-y-2">
        <Label>Email</Label>
        <Input 
          value={email} 
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
        />
      </div>
      
      {message && <p className="text-sm text-center text-red-500">{message}</p>}

      <div className="flex gap-2">
        <Button 
          onClick={handleSubmit} 
          disabled={loading}
          className="flex-1"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
        {onCancel && (
          <Button 
            variant="outline" 
            onClick={onCancel}
            className="flex-1"
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
