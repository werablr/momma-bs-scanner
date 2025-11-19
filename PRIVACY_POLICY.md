# Privacy Policy for Momma B's Scanner

**Effective Date:** November 6, 2025
**Last Updated:** November 19, 2025

## Overview

Momma B's Scanner is a household inventory management app that helps you track food items, expiration dates, and nutrition information by scanning product barcodes.

## Information We Collect

### Information You Provide
- **Product scans:** Barcodes, expiration dates, and storage locations you scan or enter
- **Account data:** Your household ID for organizing your inventory

### Information Automatically Collected
- **Product data:** Nutrition facts, product names, brands, and photos retrieved from third-party APIs (Open Food Facts, UPCitemdb, USDA FoodData Central)
- **AI-identified data:** Product names and confidence scores from OpenAI GPT-4 Vision for produce/bulk items
- **Photos:** User-uploaded photos for AI Vision identification (stored in Supabase Storage)
- **Usage data:** Scan timestamps, OCR processing results

## How We Use Your Information

We use your information to:
- Store and manage your household food inventory
- Retrieve nutrition and product information from public databases
- Display expiration dates and storage locations
- Track consumption history for analytics

## Data Storage

- All data is stored securely in Supabase (a PostgreSQL database)
- Data is associated with your household ID
- You control all data entered into the app

## Third-Party Services

We use the following third-party services:

### Open Food Facts API
- **Purpose:** Retrieve nutrition facts, health scores, dietary information, and product photos
- **Data shared:** Product barcodes
- **Privacy Policy:** https://world.openfoodfacts.org/privacy

### UPCitemdb API
- **Purpose:** Retrieve package size and product details
- **Data shared:** Product barcodes
- **Privacy Policy:** https://www.upcitemdb.com/privacy

### USDA FoodData Central API
- **Purpose:** Retrieve nutrition facts for fresh produce and raw foods
- **Data shared:** Product names (for search)
- **Privacy Policy:** https://www.usda.gov/privacy-policy

### OpenAI API (GPT-4 Vision)
- **Purpose:** Identify produce and bulk items from photos
- **Data shared:** Product photos you upload
- **Privacy Policy:** https://openai.com/policies/privacy-policy

### Supabase
- **Purpose:** Database and backend infrastructure
- **Data shared:** All inventory data you create
- **Privacy Policy:** https://supabase.com/privacy

## Data Sharing

- We **do not sell** your data to third parties
- We **do not share** your personal inventory data with other users
- Product barcodes are sent to third-party APIs only to retrieve public product information

## Data Retention

- Active inventory items remain in your account until you archive them
- Archived items are stored in history for analytics
- You can delete your data at any time by contacting us

## Your Rights

You have the right to:
- Access your data stored in the app
- Delete your data
- Export your data
- Request corrections to your data

## Security

- All data transmissions are encrypted using HTTPS
- Database access is secured with row-level security policies
- Only you can access your household's inventory data

## Children's Privacy

This app is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13.

## Changes to This Policy

We may update this privacy policy from time to time. We will notify users of any material changes by updating the "Last Updated" date.

## Contact Us

For questions about this privacy policy or your data, contact:

**Email:** werablr@gmail.com
**App Name:** Momma B's Scanner
**Developer:** Brian Rogers

## Open Source

This app's code and documentation may be made available under an open-source license in the future. Any such release will be announced and will not affect the privacy of your personal inventory data.

---

**Summary:** We collect the barcodes and expiration dates you scan, photos you upload for AI identification, retrieve public product information from free APIs, and store everything securely in a database. We don't sell your data or share it with others. You control your data and can delete it anytime.
