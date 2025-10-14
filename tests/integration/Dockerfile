FROM node:20-slim

# Install bash, git, curl and other necessary tools
RUN apt-get update && apt-get install -y bash git curl unzip && rm -rf /var/lib/apt/lists/*

# Install Bun (required for backlog-jira CLI)
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

# Set working directory
WORKDIR /app

# Install Backlog.md CLI globally with all optional dependencies
RUN npm install -g --include=optional backlog.md

# Copy package files and install dependencies
COPY package.json .
RUN npm install --production

# Copy dist and test files
COPY dist ./dist/
COPY tests/integration/test-clean-install.sh ./tests/integration/

# Link backlog-jira globally for testing
RUN npm link

# Make test script executable
RUN chmod +x tests/integration/test-clean-install.sh

# Run the integration test
CMD ["./tests/integration/test-clean-install.sh"]
