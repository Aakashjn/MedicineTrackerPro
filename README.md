MedicineTrackerPro
💊 Project Overview
Medicine Tracker Pro is a full-stack application meticulously designed to empower users in effectively managing their medication schedules. With intuitive user-friendly interfaces and robust backend logic, it ensures timely alerts, precise medicine tracking, and comprehensive history logging. This project automates its entire development lifecycle using Jenkins, thereby guaranteeing rapid, secure, and high-quality software releases.

✨ Key Features
Based on the project overview and deployed snapshots, MedicineTrackerPro offers:

Medication Scheduling: Manage and schedule medication intake effectively.

Timely Alerts: Ensure users receive timely reminders for their medication.

Medicine Tracking: Keep a clear record of medicines taken and remaining.

History Logging: Maintain a detailed history of medication adherence.

User-Friendly Interfaces: Designed for ease of use and accessibility.

Medicine inventory management

Dosage tracking

Medication reminders

Prescription management

Health analytics and reports

🚀 Technologies Used
MedicineTrackerPro leverages a modern technology stack to deliver a robust and scalable solution:

Backend: Node.js & npm

Database: SQLite

Frontend: React + Vite + TypeScript + Tailwind CSS

CI/CD Automation: Jenkins

Code Quality & Security:

SonarQube (Static Code Analysis)

Gitleaks (Secret Scanning)

Shellcheck (Shell Script Linting)

Syft (Software Bill of Materials Generation)

Trivy (Container Image Vulnerability Scanning)

Grype (Container Image Vulnerability Scanning)

OWASP Dependency-Check (Dependency Vulnerability Analysis)

Containerization: Docker

Cloud Deployment: Railway (for both frontend and backend services)

⚙️ CI/CD Pipeline Configuration Overview (Jenkins)
This CI/CD pipeline automates the entire process of building, testing, securing, and deploying the MedicineTrackerPro application. It starts with fetching the latest code, followed by comprehensive testing and coverage generation. Code quality and security are rigorously enforced through multiple static analysis and vulnerability scanning tools. The application is containerized using Docker, with the resulting image subjected to thorough vulnerability checks and SBOM generation. After passing all necessary verifications, the Docker image is pushed to a registry and deployed to Railway. A final health check ensures the application is running correctly post-deployment.

Pipeline Diagram
+------------------+
| Start            |
+------------------+
        |
        v
+------------------+
| Tool Installation|
+------------------+
        |
        v
+------------------+
| Git-CheckOut     |
+------------------+
        |
        v
+------------------+
| Run Tests and    |
| Generate Coverage|
+------------------+
        |
        v
+------------------+
| SonarQube        |
| Analysis         |
+------------------+
        |
        v
+------------------+
| GitLeaks Secrets |
| Scan             |
+------------------+
        |
        v
+------------------+
| Shell Script     |
| Linting          |
+------------------+
        |
        v
+------------------+
| Docker Build     |
+------------------+
        |
        v
+------------------+
| Syft SBOM        |
| generation       |
+------------------+
        |
        v
+------------------+
| Trivy Image      |
| Scanner          |
+------------------+
        |
        v
+------------------+
| Grype Image      |
| Scanner          |
+------------------+
        |
        v
+------------------+
| Docker Push      |
+------------------+
        |
        v
+------------------+
| Dependency Check |
+------------------+
        |
        v
+------------------+
| Deploy to Docker |
| and Railway      |
+------------------+
        |
        v
+------------------+
| Health Check     |
+------------------+
        |
        v
+------------------+
| End              |
+------------------+


Detailed Pipeline Stages:
Tools Installation: Ensures that necessary tools like Node.js, Docker, and Trivy are installed and configured on the Jenkins server, utilizing Jenkins plugins for Git, Docker, SonarQube Scanner, OWASP Dependency-Check, and Trivy integration.

Git-CheckOut: Clones the MedicineTrackerPro repository from GitHub (https://github.com/Aakashjn/MedicineTrackerPro.git), ensuring the pipeline works with the latest codebase.

Run Tests and Generate Coverage: Executes automated tests using the application's configured test runner (e.g., Jest for Node.js backend) to validate component correctness and application logic. Simultaneously, code coverage tools (like Istanbul/NYC) generate coverage reports, which feed into SonarQube for quality assessment.

SonarQube Analysis: Performs static analysis on the codebase to identify bugs, code smells, security vulnerabilities, and duplications. It consumes the test coverage report to assess code testability and applies pre-configured quality gates to determine if the code meets required standards.

GitLeaks Secrets Scan: Scans the codebase and Git history using Gitleaks to detect sensitive data leaks such as API keys, credentials, or tokens, preventing accidental exposure of critical infrastructure credentials.

Shell Script Linting: All shell scripts used in the project are linted using Shellcheck for syntax errors, deprecated syntax, insecure command usage, and portability issues, improving script reliability and maintainability.

Docker Build: Packages the backend application into a Docker container using its Dockerfile. This step captures all dependencies, runtime environments, and configurations, creating a portable image vital for consistency across environments.

Syft SBOM Generation: Uses Syft to generate a Software Bill of Materials (SBOM) from the built Docker image. This SBOM provides a comprehensive inventory of all software components, crucial for compliance, supply chain security, and vulnerability tracking.

Trivy Image Scanner: Integrates Trivy to perform container image vulnerability scanning. It detects vulnerabilities in operating system packages and application dependencies, ensuring that only secure images are deployed.

Grype Image Scanner: Provides an in-depth container image vulnerability scan using Grype (by Anchore). It detects known vulnerabilities in packages and dependencies of container images, helping to flag insecure images early and maintain a strong security posture.

Docker Push: Pushes the newly built and scanned Docker image to a registry (e.g., Docker Hub), making it available for deployment.

OWASP Dependency Checker: Performs a detailed scan of the application's declared dependencies (e.g., in package.json) using OWASP Dependency-Check. It compares them against known CVEs in public databases and flags those with security issues, providing CVSS scores and remediation advice.

Deploy to Docker and Railway: The application container is first deployed to a local Docker runtime for final pre-deployment validation, ensuring it works in isolation. Subsequently, using the Railway CLI, the backend and frontend services are deployed to the Railway cloud platform, which handles environment provisioning and runtime monitoring.

Health Check: The final stage performs automated health checks on the live application by sending HTTP requests to predefined endpoints (e.g., /health). It verifies that the deployed services are running, responsive, and returning expected HTTP status codes (usually 200).

📊 Final Result & Deployed Snapshots
The CI/CD pipeline ensures the MedicineTrackerPro application is continuously delivered and verified. Here are snapshots of the deployed website, showcasing its user interface and core functionalities:

Login/Registration Page:
(Refer to 'Image 7' in the report)

Dashboard/Overview:
(Refer to 'Image 8' in the report)

Add New Medicine:
(Refer to 'Image 9' in the report)

Today's Schedule / Your Medicines:
(Refer to 'Image 10' in the report)

Medicine History:
(Refer to 'Image 11' in the report)

History Records / Adherence Analytics:
(Refer to 'Image 12' in the report)

These snapshots confirm the successful deployment and functionality of the MedicineTrackerPro application at the URL: https://medicinetrackerpro-production.up.railway.app.

🛠️ Getting Started (Local Setup)
To set up and run MedicineTrackerPro locally for development or testing:

Prerequisites
Node.js (version 14 or higher is recommended)

npm or yarn package manager

Docker (Optional, for local container testing)

Installation
Clone the Repository:

git clone https://github.com/Aakashjn/MedicineTrackerPro.git
cd MedicineTrackerPro

Install Backend Dependencies:

cd backend
npm install

Install Frontend Dependencies:
(Assuming frontend code is in a separate directory like frontend)

cd ../frontend # Adjust path if different
npm install

Running the Application
Start the Backend Development Server:

cd ../backend # Go back to backend directory
npm start # Or 'node server.js' depending on your package.json scripts

Start the Frontend Development Server:

cd ../frontend # Go to frontend directory
npm run dev # Or 'npm start' depending on your package.json scripts

Building and Running with Docker (Optional)
If you prefer to run the application using Docker locally:

Build the Docker Image:

cd .. # Go back to the root project directory
docker build -t medicinetrackerpro-app .

Run the Docker Container:

docker run -d --name medicinetrackerpro-local -p 4000:4000 medicinetrackerpro-app

The backend API should then be accessible on http://localhost:4000.

📖 Usage
[Add detailed usage instructions here, explaining how users can interact with the MedicineTrackerPro application after setup.]

🤝 Contributing
We welcome contributions to MedicineTrackerPro! If you're interested in contributing, please follow these general steps:

Fork the repository.

Create a new feature branch (git checkout -b feature/your-feature-name).

Make your changes, ensuring code quality and test coverage.

Run local tests and linting checks.

Commit your changes (git commit -m 'feat: Add new feature for X').

Push to your feature branch (git push origin feature/your-feature-name).

Open a Pull Request to the main branch of this repository.

All pull requests will automatically trigger the Jenkins CI/CD pipeline, ensuring that all proposed changes adhere to our quality and security standards.

❓ Support
If you encounter any issues or have questions, please open an issue on GitHub.

📄 License
This project is licensed under the MIT License.
