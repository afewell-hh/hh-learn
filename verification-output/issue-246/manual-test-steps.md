# Quick Manual Test - While You're Logged In

Since you're already logged in, can you quickly test the handshake?

1. While still logged in, visit this URL:
   https://hedgehog.cloud/learn/auth-handshake?redirect_url=/learn

2. You should briefly see "Signing you in..." then redirect to /learn

3. Once on /learn, open DevTools (F12) and run this in Console:
   ```javascript
   console.log(JSON.parse(sessionStorage.getItem('hhl_identity')))
   ```

4. Tell me what you see - does it show your email and contact ID?

If YES: The handshake works fine, and it's just a Playwright automation issue
If NO: There's a problem with the handshake page itself
