# Email Quality Benchmark System - Test Guide

## Quick Test Steps

### 1. Enable Scoring (if not already enabled)
1. Open Configuration modal (gear icon)
2. Go to "Environment Config" tab
3. Check "Enable email quality scoring" checkbox
4. Click "Save & Reload"

### 2. Test Email Scoring
1. Open any email from the Dashboard
2. Click "Save for later" (if in Save for later mode) OR "Summarize Email" (if in normal mode)
3. Check browser console for: `Added 10 points to [sender] for [action]`
4. Close the email modal
5. Look for rank badge next to sender name in email list (should show #1 if first interaction)

### 3. Test Link Scoring  
1. Open an email with links
2. Click on any link (it will either save for later or generate summary depending on mode)
3. Check browser console for: `Added 3 points to [sender] for [action]`
4. Close the email modal
5. Sender rank should update

### 4. View Scoring Dashboard
1. Open Configuration modal
2. Go to "Email Scoring Dashboard" tab (Trophy icon)
3. Should see leaderboard with senders and their scores
4. Should see statistics showing total actions, senders, etc.

### 5. Test Console Commands (Advanced)
Open browser console and paste the contents of `test-scoring.js` to run automated tests.

## Expected Behavior

- **Email Summary/Save**: +10 points (configurable)
- **Link Open/Save**: +3 points (configurable)  
- **Rank Badges**: Color-coded by performance (yellow=top 10%, orange=top 25%, blue=top 50%, gray=lower 50%)
- **Dashboard**: Shows all-time and 90-day leaderboards
- **Console Logs**: Should show point additions when enabled

## Troubleshooting

### No points being added?
- Check if scoring is enabled in Environment Config
- Check browser console for error messages
- Verify you're interacting with emails (not just viewing them)

### No rank badges showing?
- Ensure scoring is enabled
- Try interacting with emails first to generate scores
- Close and reopen email modals to refresh ranks

### Points not saving?
- Check browser's localStorage isn't disabled
- Look for error messages in console
- Try clearing browser cache and retesting

## Configuration

Default settings:
- Email Summary/Save: 10 points
- Link Open/Save: 3 points
- Scoring: Enabled by default (new installations)

All settings are configurable in Environment Config tab.
