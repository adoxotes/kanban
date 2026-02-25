.PHONY: test coverage build clean

# Default target
all: build

# Run tests
test:
	go test -v ./...

# Run tests with coverage and open report in browser
coverage:
	go test -coverprofile=coverage.out ./...
	go tool cover -func=coverage.out
	@echo "To see HTML report, run: go tool cover -html=coverage.out"

# Build the binary
build:
	go build -o kanban main.go

# Clean up build artifacts and coverage files
clean:
	rm -f kanban coverage.out
