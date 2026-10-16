"""Print the OpenAPI schema without running a server: python -m woodshed_api.export_openapi"""

import json

from woodshed_api.main import app


def main() -> None:
    print(json.dumps(app.openapi(), indent=2))


if __name__ == "__main__":
    main()
