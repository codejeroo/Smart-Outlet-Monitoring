# Ping Test Directive

This directive is used to verify that the 3-layer architecture is working correctly.

## Goal
Perform a simple connectivity or "ping" test to ensure the orchestration and execution layers are communicating.

## Inputs
- `name`: (Optional) A name to include in the output.

## Execution
Use `execution/ping_test.py` with the following arguments:
- `--name`: The name to greet.

## Outputs
- A JSON object with a greeting message and a timestamp.
