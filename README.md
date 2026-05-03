# TrustLock Mobile — Native iOS & Android App

<div align="left">
  <img src="https://img.shields.io/badge/React_Native-20232A?style=flat-square&logo=react&logoColor=61DAFB" alt="React Native" />
  <img src="https://img.shields.io/badge/Expo-000020?style=flat-square&logo=expo&logoColor=white" alt="Expo" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white" alt="Supabase" />
</div>

<br />

TrustLock Mobile is the native client for the TrustLock ecosystem — a digital escrow platform built for the Cameroonian market. It allows users to securely manage peer-to-peer transactions, lock funds using MTN MoMo and Orange Money, and resolve disputes with confidence.

This app communicates directly with the backend API provided by the TrustLock Web platform.

> **Backend (Web API):** *[https://github.com/Hyson-Wayne/trustlock-mobile]*

---

## Demo — How It Works

TrustLock is designed to make transactions between strangers safe and predictable.

1. **Create Escrow**  
   A buyer creates a transaction and defines the terms.

2. **Fund Transaction**  
   Funds are securely locked via MTN MoMo or Orange Money.

3. **Delivery Phase**  
   The seller delivers the product or service.

4. **Release or Dispute**  
   - Buyer confirms → funds are released  
   - Issue detected → dispute is raised and handled by admin

Everything follows a strict state flow to prevent fraud and ensure accountability.

---

## Key Features

- **Passwordless Authentication**  
  Secure OTP login using Supabase Auth with tokens stored via `expo-secure-store`.

- **Real-Time Dashboard**  
  Live updates for escrows, wallet balances, and pending actions.

- **Transaction Engine**  
  Clean flows for escrow creation, funding, delivery confirmation, and dispute handling.

- **Native Performance**  
  Smooth animations, swipe gestures, and responsive UI built with React Native.

- **Modern UI System**  
  Glassmorphism, floating action buttons (FAB), and bottom-sheet interactions.

---

## Screenshots

<!-- Replace these with your actual images -->

### 🔐 Authentication

![Auth Screen](./screenshots/auth.png)

### 📊 Dashboard

![Dashboard](./screenshots/dashboard.png)

### 💸 Transaction Flow

![Transaction](./screenshots/transaction.png)

### ⚖️ Dispute Handling

![Dispute](./screenshots/dispute.png)

---

## System Relationship

TrustLock is a full ecosystem made of:

- **Web Platform (Next.js)** → Admin + API Gateway  
- **Mobile App (React Native)** → User-facing experience  

The mobile app does not access the database directly. All requests pass through the secure API layer.

---

## Local Development

### 1. Clone & Install

```bash
git clone https://github.com/Hyson-Wayne/trustlock-mobile.git
cd trustlock-mobile
npm install
````

### 2. Environment Setup

Create a `.env` file:

```env
# Supabase Auth
EXPO_PUBLIC_SUPABASE_URL="https://[PROJECT_REF].supabase.co"
EXPO_PUBLIC_SUPABASE_ANON_KEY="anon-key"

# Optional
EXPO_PUBLIC_APP_NAME="TrustLock"
```

### 3. Run the App

```bash
npx expo start
```

- Install **Expo Go**
- Scan the QR code
- Ensure your backend is running locally

---

## Security Notes

- Authentication handled via Supabase JWT tokens
- Tokens stored securely on-device using `expo-secure-store`
- All sensitive operations are executed through the backend API
- No direct database access from the mobile client

---

## License

Copyright © 2026 **Nditafon Hyson**. All rights reserved.

This project and its source code are the exclusive intellectual property of the author. No part of this repository may be reproduced, distributed, or transmitted in any form or by any means — including photocopying, recording, or other electronic or mechanical methods — without prior written permission.

For permission requests, please contact the author directly.

---

## Author & Contact

**Nditafon Hyson**
UI/UX Designer | DevOps Engineer | Software Developer

- [![Name](https://img.shields.io/badge/Name-Nditafon%20Hyson%20Nuigho-brightgreen)](mailto:nditafonhysonn@gmail.com)
- [![Phone](https://img.shields.io/badge/Phone-%2B237679638540-brightgreen)](tel:+237679638540)
- [![Email](https://img.shields.io/badge/Email-nditafonhysonn%40gmail.com-blue)](mailto:nditafonhysonn@gmail.com)
- [![Portfolio](https://img.shields.io/badge/Portfolio-Behance-black?logo=behance)](https://www.behance.net/nditafonhyson)
- [![GitHub](https://img.shields.io/badge/GitHub-Hyson--Wayne-lightgrey?logo=github)](https://github.com/Hyson-Wayne)
- [![LinkedIn](https://img.shields.io/badge/LinkedIn-nditafon--hyson-blue?logo=linkedin)](https://www.linkedin.com/in/nditafon-hyson-762a6623b/)

```
