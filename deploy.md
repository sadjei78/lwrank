# LWRank Deployment Guide

## 🚀 Deploy to Netlify

### Option 1: Deploy via Netlify UI (Recommended)

1. **Go to [Netlify](https://netlify.com)** and sign up/login
2. **Click "New site from Git"**
3. **Connect your GitHub/GitLab/Bitbucket account**
4. **Select your LWRank repository**
5. **Configure build settings:**
   - Build command: `npm run build`
   - Publish directory: `dist`
6. **Click "Deploy site"**

### Option 2: Deploy via Netlify CLI

1. **Install Netlify CLI:**
   ```bash
   npm install -g netlify-cli
   ```

2. **Login to Netlify:**
   ```bash
   netlify login
   ```

3. **Deploy:**
   ```bash
   netlify deploy --prod
   ```

### Option 3: Drag & Drop (Quick Test)

1. **Build the project:**
   ```bash
   npm run build
   ```

2. **Drag the `dist` folder to [Netlify Drop](https://app.netlify.com/drop)**

## 🔧 Environment Variables (Optional)

If you want to use Supabase database functionality:

1. **Go to your Netlify site settings**
2. **Navigate to "Environment variables"**
3. **Add these variables:**
   - `VITE_SUPABASE_URL` = Your Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = Your Supabase anon key

## 📝 Notes

- The app works offline using localStorage if Supabase isn't configured
- All features are functional without database connection
- The app is fully responsive and works on all devices
