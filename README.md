# LWRank - Daily Rankings Manager

A modern web application for managing daily competitive rankings with enhanced weekly analytics.

## 🚀 Features

### Core Functionality
- **Weekly Navigation**: Navigate between weeks using date picker or previous/next buttons
- **Daily Tabs**: View rankings for each day of the week (Monday through Saturday)
- **Special Events**: Create custom event tabs with start/end dates for tournaments or special competitions
- **CSV Import**: Bulk import ranking data via CSV files (admin mode)
- **Player Management**: Update player names across all data to handle name changes
- **Database Integration**: Supabase backend with localStorage fallback

### Enhanced Analytics (NEW!)
- **Top 10 Multi-Day Indicators**: Players who rank in the top 10 on multiple days are marked with `*[count]`
- **Weekly Cumulative Scores**: Players with top 5 cumulative scores across the week are highlighted with special styling and inline score indicators
- **Inline Score Display**: Cumulative scores shown as `★[score]` next to player names
- **Visual Legend**: Automatic legend explaining the indicators and styling

## 🎯 How to Use

### Basic Usage
1. Navigate to `http://localhost:5173`
2. Use the week picker or arrow buttons to select a week
3. Click on day tabs to view rankings for specific days
4. Upload CSV files in admin mode (`?admin=YOUR_ADMIN_CODE`) to add data

### Admin Features (`?admin=YOUR_ADMIN_CODE`)

#### Special Event Management
- **Create Events**: Add custom event tabs with start/end dates
- **Event Tabs**: Special events appear as purple tabs alongside regular days
- **Persistent Events**: Events persist across sessions and weeks

#### Player Name Management
- **Update Names**: Change player names across all historical data
- **Cumulative Updates**: Automatically updates weekly cumulative scores
- **Ranking Updates**: All rankings reflect the new player name
- **Confirmation**: Requires confirmation before making changes

#### CSV Import
- **Confirmation Dialog**: Preview data before importing
- **Overwrite Protection**: Clear warnings when replacing existing data
- **Faction Filtering**: Automatically removes faction tags from imports

### Understanding the Enhanced Features

#### Top 10 Multi-Day Indicators
- Players who appear in the top 10 on multiple days show `*[count]` next to their name
- Example: `PlayerName *3` means they ranked in top 10 on 3 different days

#### Weekly Cumulative Highlights
- Players with top 5 cumulative scores across the week have special gradient styling
- Cumulative scores are displayed inline as `★[score]` next to player names
- These players are highlighted in both top 10 and bottom 20 sections

## 🛠️ Development

### Setup
```bash
npm install
npm run dev
```

### Build for Production
```bash
npm run build
```

### Environment Variables
For full database functionality, set up Supabase environment variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 📊 Data Format

### CSV Import Format
```csv
Ranking,Commander,Points
1,PlayerName,1500
2,AnotherPlayer,1400
```

**Note**: Faction/clan columns in CSV files will be automatically ignored. Only ranking, commander, and points data is processed.

### Database Schema
- `day`: Date key (YYYY-MM-DD)
- `ranking`: Position number
- `commander`: Player name
- `points`: Points value

## 🎨 Styling

The application features:
- Modern glassmorphism design
- Responsive layout for all devices
- Dark mode support
- Smooth animations and transitions
- Enhanced visual indicators for analytics

## 🔧 Technical Stack

- **Frontend**: Vanilla JavaScript (ES6 modules)
- **Build Tool**: Vite
- **Database**: Supabase (PostgreSQL)
- **Styling**: Custom CSS with modern design patterns
- **Deployment**: Static site ready

## 📈 Analytics Features

### Weekly Statistics
- **Top 10 Occurrences**: Tracks how many times each player appears in top 10
- **Cumulative Scores**: Calculates total points across all days in the week
- **Visual Indicators**: Clear visual feedback for high-performing players

### Performance Insights
- Identify consistently high-performing players
- Track weekly cumulative performance
- Visual distinction for top performers
- Interactive tooltips for detailed information
# Updated 08/09/2025 16:00:35
