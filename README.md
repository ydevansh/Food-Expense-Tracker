# 🍽️ Food Expense Tracker — MERN Stack

Track daily breakfast & dinner expenses for **Gaurav**, **Nikhil**, and **Devansh**. Calculates individual shares, records payments, and generates settlements every 15 days or monthly.

---

## 🚀 Setup Instructions

### 1. Configure MongoDB Atlas

Edit `backend/.env` and replace with your actual Atlas URI:

```
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/food_expense_tracker?retryWrites=true&w=majority
PORT=3001
```

### 2. Start the Backend

```bash
cd backend
npm run dev
```

Backend runs at: **http://localhost:3001**

On first run, it auto-seeds:
- Users: Gaurav, Nikhil, Devansh
- Prices: Breakfast = ₹50/plate, Dinner = ₹70/plate

### 3. Start the Frontend

```bash
cd frontend
npm run dev
```

Frontend runs at: **http://localhost:5173**

---

## 📱 Features

| Page | Feature |
|------|---------|
| **Dashboard** | Today's meals, monthly stats, running balances |
| **Calendar** | Navigate history month-by-month, click any date for details |
| **Add Expense** | Fast meal entry with real-time share calculation |
| **History** | All meals with filters (date, meal type, person, paid by) |
| **Settlement** | Create 15-day / monthly settlement, track payments |
| **Reports** | Period-based expense breakdown per person |
| **Settings** | Update meal prices (old records never change) |

## 🧮 Key Logic

- **Individual share** = Total ÷ Number of people who ate that meal
- **Rounding** guaranteed: shares always sum exactly to total (penny-correct)
- **Price history**: price change only affects future records, never old ones
- **Settlement**: accumulates shares & payments, generates minimum transactions to settle

## 🛠️ Tech Stack

- **MongoDB Atlas** — cloud database
- **Express.js** — REST API
- **React 18 + Vite** — frontend SPA
- **React Router v6** — routing
- **Axios** — HTTP client
- **Node.js** — runtime
