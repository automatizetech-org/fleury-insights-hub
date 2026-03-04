

# Plan: Migrar Design System do WK Analytics para Fleury Analytics

## Resumo

Replicar o design system do GrupoWK Dashboard Web no projeto atual, adaptando de "WK Analytics" para "Fleury Analytics". Isso envolve trocar o tema navy/gold atual pelo tema blue/purple do WK, recriar a tela de login no mesmo estilo, atualizar sidebar, layout e landing page do dashboard, e portar todos os efeitos CSS avançados (3D cards, glassmorphism, neon glow, gradient borders, shimmer, floating particles, etc.).

## Escopo das Mudanças

### 1. Substituir o CSS global (`src/index.css`)
- Trocar as CSS variables navy/gold pelas do WK: `--primary-blue: #2563EB`, `--secondary-purple: #7C3AED`, backgrounds `#F9FAFB` / `#0F172A` (dark)
- Portar todas as classes utilitarias do WK: `.card-3d`, `.card-3d-elevated`, `.glass-effect`, `.gradient-3d`, `.shadow-3d`, `.shadow-3d-hover`, `.glow-effect`, `.neon-glow`, `.gradient-border`, `.shimmer`, `.backdrop-3d`, `.slide-in-up`, `.rotate-3d`
- Portar animações: `bar-grow-3d`, `area-fill-3d`, `slide-in-3d`, `float`, `pulse-slow`, `gradient-shift`, `fade-in-up`, `logo-float`, `quote-float`, `zoom-in`, `slide-in-from-bottom-4`
- Manter dark mode com transição suave (0.5s cubic-bezier)
- Portar mobile optimizations (touch-manipulation, reduced animations)

### 2. Atualizar Tailwind config (`tailwind.config.ts`)
- Adicionar cores do WK: `primary-blue`, `secondary-purple`, `neutral.*`, `status.*`, `chart.1-8`
- Manter cores existentes do shadcn/ui para compatibilidade com componentes UI
- Adicionar fonte mono `Fira Code`

### 3. Recriar Login Page (`src/pages/LoginPage.tsx`)
- Background com gradiente `from-red-50 via-white to-blue-50` + radial gradients
- SVG dot pattern overlay
- Floating particles (3 blobs com blur-3xl e animate-pulse)
- Card central com `bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl`
- Logo com gradiente `from-red-600 to-primary-blue` + ring
- Título "Fleury • Dashboard Web" + "Login" (bold)
- Inputs com `border-2` + focus ring azul
- Botão gradiente azul com `shadow-lg shadow-primary-blue/25` + hover scale
- Botão Admin com pill style
- Animações: `slide-in-from-bottom-4`, `zoom-in`

### 4. Atualizar AppSidebar (`src/components/AppSidebar.tsx`)
- Trocar de sidebar escura (navy) para sidebar clara com gradiente sutil `from-white via-white to-neutral-50` (dark: `from-slate-800 to-slate-900`)
- Background overlay com `from-primary-blue/5 to-secondary-purple/5`
- Header com logo Fleury + "Departamentos"
- Nav items com estilo `.card-3d`: selecionado = gradiente azul solid, não selecionado = `bg-white/80 backdrop-blur-sm` com border
- Brand box com estilo `.wk-sidebar-brand` (gradiente sutil, border, inset shadow)

### 5. Atualizar AppLayout (`src/components/AppLayout.tsx`)
- Header com `.backdrop-3d` (blur 20px)
- Dark mode toggle no canto superior direito
- Floating particles na landing page (quando sem departamento selecionado)

### 6. Atualizar Landing/Dashboard Home
- Logo com animação `logo-float` + glow rings
- Título "Fleury Analytics" com `bg-gradient-to-r from-primary-blue via-amber-500 to-primary-blue bg-clip-text text-transparent animate-gradient-shift`
- Subtítulo "Plataforma de Análise e Gestão Empresarial"
- Quote section com glassmorphism
- Bouncing dots decorativos
- Badge "Insights em Tempo Real"

### 7. Atualizar GlassCard e componentes de dashboard
- Trocar `.glass-card` pelo estilo `.card-3d-elevated` do WK
- Hover com `translateY(-8px) rotateX(2deg)` + shadow 3D
- Gradient borders nos cards importantes

### 8. Remover `src/App.css`
- Arquivo legado do Vite template, não mais necessário

## Arquivos Modificados
- `src/index.css` -- reescrita completa
- `tailwind.config.ts` -- adição de cores WK
- `src/pages/LoginPage.tsx` -- reescrita completa
- `src/components/AppSidebar.tsx` -- visual atualizado
- `src/components/AppLayout.tsx` -- header/landing atualizados
- `src/components/dashboard/GlassCard.tsx` -- estilo card-3d
- `src/pages/Dashboard.tsx` -- landing page com efeitos WK
- `src/App.css` -- deletar

