You are working on an Oil Distribution Management & Analytics System.

Read the complete product requirements document located at:

docs/PRD.md

IMPORTANT:
Do NOT start implementing the application yet.

First analyze the PRD and produce a technical implementation plan.

Technology constraints:

* Frontend: React + Vite
* Language: JavaScript
* Styling: CSS
* Backend platform: Supabase
* Database: PostgreSQL through Supabase
* Authentication: Supabase Auth
* File storage: Supabase Storage
* Authorization: PostgreSQL Row Level Security (RLS)
* Do NOT use Django.
* Do NOT create a Node.js/Express backend.
* Do NOT introduce another backend framework.

The application has two primary roles:

1. Manager
2. Staff

The manager has all staff capabilities plus manager-only administrative capabilities.

Staff access must be restricted according to their assignments. A staff member should only be able to see their assigned distribution routes and fuel stations.

Before writing code, analyze the requirements and produce:

1. Recommended application architecture
2. React application structure
3. Supabase architecture
4. PostgreSQL entity/model list
5. Entity relationships
6. Authentication architecture
7. Role and permission architecture
8. RLS strategy
9. Supabase Storage strategy
10. Major application modules
11. Development phases
12. Potential business-rule risks
13. Requirements that still need clarification

Do NOT invent missing business requirements.

If something is not specified in docs/PRD.md, mark it as TBD.

Do not modify or create application source code during this step.

Wait for approval after presenting the implementation plan.
