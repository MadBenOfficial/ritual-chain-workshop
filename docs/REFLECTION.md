# Reflection

**What should be public, what should stay hidden, and what should be decided by
AI versus by a human in a bounty system?**

The process itself should be public: the brief, the judging rubric, the reward,
the deadlines, and the commitment of every entrant, because participants can only
trust a contest they are able to audit afterward. The answers, however, must stay
hidden while submissions are open, since visible answers let later entrants copy
and refine earlier ideas and quietly destroy the fairness of a winner-takes-all
race. Once the submission window closes, the answers can safely become public
(commit-reveal) or stay encrypted and be judged privately inside a TEE
(Ritual-native), depending on how much confidentiality the bounty needs. AI is the
right tool for the heavy, repetitive part: reading every eligible answer at once
and producing a consistent, rubric-based ranking with reasons — a batch task no
human wants to do by hand for dozens of entries. But the AI should only recommend,
because language models can be prompt-manipulated, can hallucinate scores, and
carry no accountability for moving money. The final decision and the payout belong
to a human owner, who can sanity-check the ranking against the rubric, reject a
clearly gamed result, and answer for the outcome. In short: keep the rules
transparent, keep the content hidden until the right moment, let AI scale the
evaluation, and let a human own the verdict.
