Example: Changing UI
Let’s say you want to change a button color:
Open the file (e.g., components/LandingPage.tsx)
Change the button color
Save the file
Run in terminal:

git add .
git commit -m "App Updates"
git push origin main

Wait 2–5 minutes
Refresh your website → changes are live

https://generativelanguage.googleapis.com/v1beta/models?key=API_KEY
To check which models can be used in the current api key


How to stop anything on a certain port?
1) Find the process using 3002:
netstat -ano | findstr :3002
You’ll see a line ending with a PID (a number).
2) Kill it:
taskkill /PID <PID> /F
3) Start backend again.

