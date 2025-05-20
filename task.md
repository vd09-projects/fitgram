# 📌 Task Tracker

## 🔹 Task Status Legend:  
✅ **Completed** | ⏳ **In Progress** | 🚫 **Not Started**  

## 🛠 Tasks & Timeline  

### 🔹 **Phase 1: UI/UX Setup**
| Task | Status | Timeline | Notes |
|------|--------|----------|-------|
| **Build the header, create a dummy home page, and add a logout button** | ✅ | 1-2 days | Done. |
| **Implement logout functionality** | ✅ | 1-2 days | Done. |
| **Update color schema for text** | 🚫 | 1-2 days | Adding light, dark, and custom anime themes. Centralizing color definitions. |
| **Add footer with two buttons: Feed (dummy feed page) & Exercise** | ✅ | 1-2 days | Done. |
| **Centralize page styles** | ✅ | 1-2 days | Done. |
| **Improve navigation (use better routing)** | ✅ | 1-2 days | Done. |

### 🔹 **Phase 2: Logout/Login Setup**
| Task | Status | Timeline | Notes |
|------|--------|----------|-------|
| **Adding validation to login page input fields** | ✅ | 1-2 days | like email, name and passowrd; Done. |
| **Show user name insted of email to home page** | ✅ | 1-2 days | In hook try to fetch user details also; Done. |
| **Have color and design schema consistent every where till home and footer page** | ✅ | 1-2 days | Done |

### 🔹 **Phase 3: Exercise Section**
| Task | Status | Timeline | Notes |
|------|--------|----------|-------|
| **Design the exercise layout with three buttons** | ✅ | 2-3 days | Done. |
| **Make three buttons style consistent** | ✅ | 1-2 days | have a same design; Done. |
| **Create the Add Exercise page** | ✅ | 1-2 days | Done. |
| **Implement exercise logging functionality** | ✅ | 1-2 days | Done. |
| **Stop showing footer when writing input** | ✅ | 1-2 days | Done. |
| **Add validations to input fields for Add page** | ✅ | 2-3 days | when adding workout and save exercise have some kind of validation; Done |
| **Develop the workout management page** | ✅ | 2-3 days | Done. |
| **Rename workout management layout for better clarity** | ✅ | 1 day | Done. |
| **Integrate exercise logging functionality within workout management** | ✅ | 2-3 days | Done. |
| **Improve input box design for workout logging (field name at top)** | ✅ | 1-2 days | Done. |
| **Implement full workout & exercise management features** | ✅ | 2-3 days | Done. |
| **Show loading state while fetching data from DB** | ✅ | 2-3 days | Done. |
| **Handle when action workout is going on then don't let new workout start** | ✅ | 2-3 days | Done. |

### 🔹 **Phase 4: Data Tracking & Visualization**
| Task | Status | Timeline | Notes |
|------|--------|----------|-------|
| **Develop the data viewing feature** | ✅ | 2-3 days | Done. |
| **Design the data viewing layout** | ✅ | 1-2 days | Done. |
| **Implement data visualization graphs** | 🚫 | 2-3 days | Pending. |
| **Add interactive data functionality** | 🚫 | 2-3 days | Pending. |
| **Ensure the most recent data is correctly logged and displayed** | ✅ | 1-2 days | Done. |

### 🔹 **Phase 5: Workout Plan & Accessibility**
| Task | Status | Timeline | Notes |
|------|--------|----------|-------|
| **Enable users to start/stop workout plans** | ✅ | 2-3 days | Done. |
| **Add quick-access button for active workout plans in the footer** | ✅ | 1-2 days | Done. |

### 🔹 **Phase 6: UI/UX Consistency**
| Task | Status | Timeline | Notes |
|------|--------|----------|-------|
| **Make dropdown use centlize colors scheme** | ✅ | 2-3 days | righ now alot of data is hard coded we need to impove on this; Done |
| **Make editable list use centlize input and color scheme** | ✅ | 1-2 days | righ now alot of data is hard coded we need to impove on this; Done |
| **Make Active Workout screen use centlize input and color scheme** | ✅ | 1-2 days | righ now alot of data is hard coded we need to impove on this; Done |
| **Add validation in Active Workout logging** | ✅ | 1-2 days | Done |
| **Make Exercise History screen use centlize input and color scheme** | ✅ | 1-2 days | righ now alot of data is hard coded we need to impove on this; Done |
| **add consistency in tabel right now they all have diffrent code** | ✅ | 2-3 days | we have 2-3 type of tabel find similairty and have comon component; Done |
| **create outlined input componet to use for text input** | ✅ | 3-4 days | Done. |
| **insted of simple input start using outline input every where** | ⏳ | 1-2 days | not yet started |

### 🔹 **Phase 7: Data Access Rules**
| Task | Status | Timeline | Notes |
|------|--------|----------|-------|
| **Allow user to access only their own data** | ✅ | 1-2 days | Done |
| **Use environment-specific Firebase projects** | ✅ | 1 day | Ensures separation of dev, staging, and prod environments |
| **Restrict Firebase API key in Google Cloud Console** | 🚫 | 1 day | Limited to specific platform bundles (iOS/Android/Web) |
| **Secure Firebase rules using `auth.uid == userId`** | ✅ | 1–2 days | Prevents unauthorized access to other users’ data; DONE |
| **Enable Firebase App Check for all supported services** | 🚫 | 1–2 days | Ensures only real app instances access Firebase |
| **Avoid using Admin SDK or service account keys in client app** | 🚫 | Immediate| Admin credentials must never be exposed in the frontend |
| **Never include Firebase Admin SDK or service keys in client apps** | 🚫 | Ongoing | This is a non-negotiable rule to prevent full project compromise |

### 🔹 **Phase 8: Social Media & Extras**
| Task | Status | Timeline | Notes |
|------|--------|----------|-------|
| **Develop a basic social media feed** | TBD | TBD | To be decided. |

---

### 📝 Notes:
- Prioritize **UI/UX design** before functionality implementation.
- **Firebase** will be used for data storage & authentication.
- Keep **social media sharing** simple & intuitive.
- Regularly update task status as progress is made!
- Tasks can be added or updated in the table as necessary.