# Use Nginx to serve static files
FROM nginx:alpine

# Remove default nginx website
RUN rm -rf /usr/share/nginx/html/*

# Copy static files to nginx directory
# We copy both chatbot and dashboard directories
COPY chatbot /usr/share/nginx/html/chatbot
COPY dashboard /usr/share/nginx/html/dashboard

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
