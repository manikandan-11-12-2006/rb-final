# Standalone Patient Feedback Interface (HTML / CSS / JS)

A lightweight, 100% self-contained **HTML, CSS, and Vanilla JS** implementation of the RescueBridge Patient Feedback & Review Interface.

## 📁 Directory Files

- **`index.html`** — Main patient feedback page structure.
- **`styles.css`** — Modern, responsive CSS design with glassmorphism, star animations, mic pulse effects, and badges.
- **`app.js`** — Vanilla JS logic handling star rating, Web Speech API voice transcription, Groq AI text cleanup (`llama3-70b-8192`), auto-copy, and screen navigation.

---

## 🚀 How to Run

1. **Direct Browser Open (Double Click)**:
   Simply double-click `index.html` or drag it into Google Chrome / Microsoft Edge.

2. **Host via any Local Web Server**:
   You can serve the folder using any HTTP server:
   ```bash
   # Using Python 3
   python -m http.server 8000

   # Or using npx serve
   npx serve .
   ```

---

## 🌐 Customizing via URL Query Parameters

You can personalize the patient interface dynamically using URL parameters:

```text
index.html?patient=Priya%20Sharma&hospital=CityCare%20Clinic&doctor=Ramesh%20Kumar
```

### URL Parameters:
- `patient` or `name` — Patient name
- `hospital` — Hospital or Clinic name
- `doctor` — Doctor name
