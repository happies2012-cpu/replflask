#!/bin/bash
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

PROMPT_FILE="replit_agent_mega_prompt.txt"

echo -e "${CYAN}🚀 Generating Ultimate Replit Agent 4 Mega-Prompt...${NC}\n"

cat << 'PROMPT' > "$PROMPT_FILE"
**DIRECTIVE: TAKE FULL AUTONOMOUS CONTROL**
Act as an Expert Full-Stack Architect and Lead UI/UX Designer. Your mission is to complete ALL pending tasks across ALL phases in a single, uninterrupted execution workflow. Do not ask for clarification, do not wait for approval, and do not output partial "TODO" placeholders. Make optimal, industry-standard decisions and generate the complete, production-ready codebase immediately.

**TECH STACK**
- Framework: Next.js 14+ (App Router) or React 18+ (Vite)
- Styling: Tailwind CSS (utilizing CSS variables for seamless theming)
- Animations: Framer Motion (for complex UI transitions and background motions)
- Icons: Lucide React
- Utilities: clsx, tailwind-merge

**DESIGN SYSTEM REQUIREMENTS (Strict Adherence)**
1. Advanced Glassmorphism: All major UI sections must feature premium glassy effects. Use backdrop-filter: blur(16px), semi-transparent backgrounds (e.g., bg-white/10 for light, bg-black/20 for dark), and subtle 1px borders (border-white/20).
2. Flawless Dark & Light Mode: Implement a robust theme toggle. Glassy effects must adapt gracefully to both themes.
3. Latest UI/UX Trends: Micro-interactions on hover, subtle gradient mesh backgrounds, modern typography, and generous whitespace.
4. Background Motions & Animations: Implement a global AnimatedBackground component with slow-moving, blurred gradient orbs using Framer Motion. Add staggered entrance animations for all components.
5. Robotic/Futuristic Content: All placeholder text, headings, and UI copy MUST be generated in a precise, futuristic, "robotic" tone (e.g., "System Initialized", "Neural Link Established", "Processing Data Matrix").

**EXECUTION PHASES (Execute ALL sequentially in this single run)**
Phase 1: Foundation - Configure Tailwind with custom glassmorphism utilities and a robust ThemeProvider.
Phase 2: Core Reusable Components - Create GlassCard, GlassButton, AnimatedBackground, and ThemeToggle.
Phase 3: Page Assembly - Build a complete, production-ready Landing Page or Dashboard utilizing the components, fully responsive, with robotic content injected.
Phase 4: Polish - Add ARIA labels, ensure zero console errors, optimized imports, and clean modular file structure.

**CONSTRAINTS**
- Write the ACTUAL, COMPLETE code for every file. No "// ... rest of the code" abbreviations.
- Ensure all components are modular and exported for reusability.
- Execute this entire prompt as a single, comprehensive generation. Begin coding immediately.
PROMPT

echo -e "${GREEN}✅ Script executed successfully!${NC}"
echo -e "${CYAN}============================================================${NC}"
echo -e "${GREEN}👇 COPY THE TEXT BELOW AND PASTE IT INTO THE REPLIT AGENT CHAT 👇${NC}"
echo -e "${CYAN}============================================================${NC}\n"

cat "$PROMPT_FILE"

echo -e "\n${CYAN}============================================================${NC}"
echo -e "${GREEN}💡 Tip: If the agent stops mid-generation, just type 'continue exactly where you left off'.${NC}"
