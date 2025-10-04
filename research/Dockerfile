
ARG RESEARCH_BASE_VERSION

FROM sidawater/research-base:${RESEARCH_BASE_VERSION}

WORKDIR /app

COPY . .


EXPOSE 8000

CMD ["python", "run.py"]