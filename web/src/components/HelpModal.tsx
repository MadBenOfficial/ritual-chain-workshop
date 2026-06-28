"use client";

import { Modal, Button } from "@/components/ui";

export function HelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="How the eclipse works"
      subtitle="Commit-reveal + AI batch judging on Ritual"
      footer={
        <Button onClick={onClose}>Got it</Button>
      }
    >
      <ul className="space-y-2">
        <li>
          <span className="text-[var(--eclipse-label,inherit)] font-medium text-[var(--ash)]">1 · Commit.</span>{" "}
          Your answer enters eclipse — only the commitment corona (a hash) is public. Your salt is
          the moon that opens it; it&apos;s saved only in this browser.
        </li>
        <li>
          <span className="font-medium text-[var(--ash)]">2 · Reveal.</span> After the submission
          deadline, reveal answer + salt. The contract recomputes the hash; only matching, revealed
          answers are eligible.
        </li>
        <li>
          <span className="font-medium text-[var(--ash)]">3 · Judge.</span> The Ritual AI reads the
          whole constellation in one batch pass. No one-by-one calls.
        </li>
        <li>
          <span className="font-medium text-[var(--ash)]">4 · Finalize.</span> AI recommends. A human
          owner aligns the winning star in a golden orbit and the reward is paid.
        </li>
      </ul>
    </Modal>
  );
}
