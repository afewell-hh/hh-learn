Test Results Analysis:

## Key Finding
The membership profile API returns 404 after login, indicating the membership session is not being established.

## Evidence
1. Auth context after login: email=null, contactId=null
2. Membership profile API: { status: 404 }
3. CTA button still shows 'Sign in to start course'
