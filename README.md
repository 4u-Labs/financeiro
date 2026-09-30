<div align="center">

# 💰 4U Finance Pro
### **Cockpit de Gestão Financeira Inteligente • Offline-First • Regra 50/30/20 • Importador OFX**

[![Website](https://img.shields.io/badge/Acessar_Online-4u.ia.br%2Fapp%2Ffinanceiro-10b981?style=for-the-badge&logo=google-chrome&logoColor=white)](https://4u.ia.br/app/financeiro/)
[![Tech Blog](https://img.shields.io/badge/Tech_Blog-4u--labs.github.io-06b6d4?style=for-the-badge&logo=jekyll&logoColor=white)](https://4u-labs.github.io)
[![Zero-Knowledge](https://img.shields.io/badge/Privacidade-Zero--Knowledge-8b5cf6?style=for-the-badge&logo=shield)](https://4u.ia.br/app/financeiro/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

</div>

---

## 🌟 Visão Geral

O **4U Finance Pro** é uma plataforma moderna e completa de controle financeiro pessoal e corporativo, desenvolvida sob o conceito **100% Offline-First (Zero-Knowledge)**. 

Seus dados financeiros, extratos bancários e saldos **nunca saem do seu navegador**. O aplicativo dispensa cadastros invasivos, mensalidades e conexões arriscadas com APIs bancárias terceirizadas, entregando ferramentas de nível institucional diretamente no front-end.

---

## ⚡ Principais Funcionalidades

### 1. 💳 Motor de Parcelamento & Recorrência
- Lançamento inteligente de compras parceladas em até **72x**.
- Geração cronológica automática das parcelas futuras com identificação de amortização (`1/10`, `2/10`, etc.).
- Suporte a despesas e receitas fixas recorrentes.

### 2. 🏦 Multicontas & Carteiras Dinâmicas
- Gestão centralizada de múltiplas contas (Nubank, Itaú, Carteira em Dinheiro, Investimentos & Reserva, etc.).
- Transferências internas entre contas sem distorção das métricas operacionais e DRE.
- Filtragem instantânea clicando no card da conta desejada.

### 3. 📄 Importador Inteligente de Extratos `.OFX` e CSV
- Compatibilidade universal com arquivos `.OFX` emitidos por bancos brasileiros (Nubank, Itaú, Bradesco, Banco do Brasil, Inter, etc.).
- Leitura de tags `<STMTTRN>`, `<TRNAMT>` e `<MEMO>` com **autocategorização inteligente** por padrões textuais e palavras-chave.
- Importação e exportação completa em CSV e backup estruturado em JSON.

### 4. 🎯 Termômetro de Saúde Financeira — Regra 50 / 30 / 20
- Segmentação visual em tempo real das despesas:
  - **Necessidades Essenciais (50%):** Moradia, Alimentação, Saúde, Contas básicas e Transporte.
  - **Estilo de Vida & Desejos (30%):** Lazer, Restaurantes, Compras e Streaming.
  - **Investimentos & Futuro (20%):** Aportes, Reserva de emergência e Previdência.

### 5. 📊 Relatório Executivo Mensal em PDF
- Geração instantânea *client-side* via **jsPDF** e **jsPDF-AutoTable**.
- Inclui cabeçalho executivo formatado, KPIs consolidados do mês, diagnóstico da regra 50/30/20 e tabela detalhada de lançamentos.

### 6. 🧮 Calculadoras Financeiras Embutidas
- **Juros Compostos:** Simulação de aporte inicial, depósitos mensais, taxas e períodos com gráfico visual da curva de juros vs. capital acumulado (Chart.js).
- **CLT vs. PJ:** Comparativo analítico entre remuneração líquida em regime CLT (incluindo 13º, férias, FGTS e rescisão estimada) versus contratação como Pessoa Jurídica (Simples Nacional / Lucro Presumido).

### 7. 👁️ Modo Privacidade (Zero-Knowledge)
- Botão no topo (`👁️`) que ativa imediatamente uma máscara de proteção sobre todos os valores (`R$ •••••`), ideal para uso em cafés, escritórios e ambientes compartilhados.

### 8. 🧹 Iniciar do Zero & Dados de Demonstração
- Carrega automaticamente uma estrutura demonstrativa rica no primeiro acesso para apresentação do sistema.
- Botão **`🧹 Iniciar do Zero`** no topo para limpar os lançamentos de exemplo e começar suas finanças reais com um único clique.

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologia |
| :--- | :--- |
| **Interface** | HTML5 Semântico, CSS3 Moderno (Glassmorphism & Neon Fintech Design System) |
| **Lógica & Core Engine** | JavaScript ES6+ Modular Orientado a Objetos (`FinanceProApp`) |
| **Gráficos & Dashboards** | Chart.js 3.9 (Barras de Fluxo de Caixa Semestral & Doughnut de Categorias) |
| **Documentos & Exportação** | jsPDF 2.5 + jsPDF-AutoTable |
| **Persistência** | LocalStorage API com arquitetura Offline-First |
| **Ícones & Tipografia** | FontAwesome 6, Google Fonts (Orbitron & Inter) |

---

## 🚀 Como Executar Localmente

Não requer instalação de Node.js, PHP ou banco de dados no backend:

```bash
# Clone o repositório
git clone https://github.com/4u-Labs/financeiro.git

# Acesse o diretório
cd financeiro

# Abra o arquivo no navegador
open index.html # ou no Linux: xdg-open index.html
```

---

## 🌐 Demonstração Online

A versão oficial de produção está disponível em:
👉 **[https://4u.ia.br/app/financeiro/](https://4u.ia.br/app/financeiro/)**

Artigo técnico no blog oficial:
👉 **[4U-Labs Tech Blog](https://4u-labs.github.io)**

---

## 📄 Licença

Distribuído sob a licença **MIT**. Consulte o arquivo `LICENSE` para mais informações.

Desenvolvido com excelência por **Fabiano Braga // [4U.IA.BR](https://4u.ia.br)**.
