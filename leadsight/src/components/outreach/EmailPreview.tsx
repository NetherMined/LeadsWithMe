"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

interface EmailPreviewProps {
  emailSubject: string;
  emailBody: string;
  linkedinNote: string;
  linkedinFollowup: string;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(err => {
    console.error("Failed to copy:", err);
  });
}

export function EmailPreview({
  emailSubject,
  emailBody,
  linkedinNote,
  linkedinFollowup,
}: EmailPreviewProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (text: string, field: string) => {
    copyToClipboard(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleOpenInGmail = () => {
    const gmailUrl = `https://mail.google.com/mail/?view=cm&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    window.open(gmailUrl, "_blank");
  };

  return (
    <Tabs defaultValue="email" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="email">Email</TabsTrigger>
        <TabsTrigger value="linkedin">LinkedIn</TabsTrigger>
      </TabsList>

      <TabsContent value="email" className="space-y-4 mt-4">
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase text-muted-foreground">Subject Line</label>
          <div className="flex items-start gap-2">
            <div className="flex-1 rounded-lg border border-border bg-card p-3">
              <p className="text-sm text-foreground">{emailSubject}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCopy(emailSubject, "subject")}
              className="h-9 px-2 text-xs"
            >
              {copiedField === "subject" ? "✓" : "Copy"}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase text-muted-foreground">Email Body</label>
          <div className="flex items-start gap-2">
            <div className="flex-1 rounded-lg border border-border bg-card p-3">
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-secondary-foreground font-sans">
                {emailBody}
              </pre>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCopy(emailBody, "body")}
              className="h-9 px-2 text-xs"
            >
              {copiedField === "body" ? "✓" : "Copy"}
            </Button>
          </div>
        </div>

        <Button
          onClick={handleOpenInGmail}
          variant="outline"
          size="sm"
          className="w-full"
        >
          Open in Gmail
        </Button>
      </TabsContent>

      <TabsContent value="linkedin" className="space-y-4 mt-4">
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase text-muted-foreground">
            Connection Note ({linkedinNote.length}/300)
          </label>
          <div className="flex items-start gap-2">
            <div className="flex-1 rounded-lg border border-border bg-card p-3">
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-secondary-foreground font-sans">
                {linkedinNote}
              </pre>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCopy(linkedinNote, "linkedin-note")}
              className="h-9 px-2 text-xs"
            >
              {copiedField === "linkedin-note" ? "✓" : "Copy"}
            </Button>
          </div>
          {linkedinNote.length > 300 && (
            <p className="text-xs text-destructive">Note exceeds 300 character LinkedIn limit</p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase text-muted-foreground">Follow-up Message</label>
          <div className="flex items-start gap-2">
            <div className="flex-1 rounded-lg border border-border bg-card p-3">
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-secondary-foreground font-sans">
                {linkedinFollowup}
              </pre>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCopy(linkedinFollowup, "linkedin-followup")}
              className="h-9 px-2 text-xs"
            >
              {copiedField === "linkedin-followup" ? "✓" : "Copy"}
            </Button>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
