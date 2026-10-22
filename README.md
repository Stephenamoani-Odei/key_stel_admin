# Key-Stel Admin

The staff dashboard for **Key-Stel**, a door shop ("Your Secured Partner!"). Staff use it to manage doors, stock, online orders, walk-in sales, customers and reports. Everything is read from and written to Supabase. There is no demo data.

The public storefront is a separate project. It shares the same Supabase database, so doors, prices and stock levels you change here show up on the website.

---

## Features

| Page | What it does |
| --- | --- |
| **Overview** | Last-7-days dashboard: revenue, top products, sales rolled up by category group |
| **Point of Sale** | Record an in-shop sale (Cash, MoMo or Card), apply a discount, add a note, print a receipt. Stock drops automatically |
| **Products** | Add, edit and delete doors: price, sizes, photos, stock, low-stock alert level, available or hidden |
| **Categories** | Group doors into categories and category groups |
| **Inventory** | Adjust stock counts as doors come in and go out, with low-stock highlighting |
| **Orders** | Track online and walk-in orders from Pending to Dispatched to Delivered. Mark paid or unpaid, print receipts, search by order number, name or phone |
| **Customers** | Customer list built from orders, with order counts and total spent. CSV export |
| **Messages** | Contact-form messages from the website, with an unread badge |
| **Sales & Analytics** | Revenue by day, top products by revenue, payment breakdown |
| **Reports** | CSV downloads for sales, items sold, stock and customers (open in Excel) |
| **Staff & Access Control** | Add or remove staff and admins, reset passwords (admins only) |
| **Settings** | Store contact details shown on the storefront, receipt footer text, your sign-in name and password |

Also included:

- Global search (products, orders, customers) and a notification bell for pending orders, unread messages and low stock
- Sign in with a short name or with an email address
- Forced password change on first login for new staff
- Responsive layout that works on phones and tablets
- Role-based access: `superadmin`, `admin` and `staff`

---

## Tech stack

- **React 18** with **Vite 5**
- **Supabase**: Postgres, Auth, Row Level Security and Storage
- **lucide-react** for icons
- Plain CSS, with no UI framework

---

## How orders work

1. **Online orders:** a customer places an order on the website with name, phone and delivery address. It arrives in **Orders** as *Pending* and *Unpaid*, and stock drops automatically.
2. Staff call or WhatsApp the customer, agree the details and collect payment directly. There is no online payment on the website.
3. Staff update the status to *Dispatched* or *Delivered* and mark the order as paid.
4. **Walk-in sales** are recorded in **Point of Sale**. They are saved as paid and delivered, and a receipt can be printed.
