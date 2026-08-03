package com.apisentinel.backend.service;

import com.apisentinel.backend.entity.Route;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.Operation;
import io.swagger.v3.oas.models.PathItem;
import io.swagger.v3.parser.OpenAPIV3Parser;
import io.swagger.v3.parser.core.models.SwaggerParseResult;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class OpenApiParserService {

    public List<Route> parse(byte[] fileContent) {
        String content = new String(fileContent);

        OpenAPIV3Parser parser = new OpenAPIV3Parser();
        SwaggerParseResult result = parser.readContents(content, null, null);
        OpenAPI openAPI = result.getOpenAPI();

        List<Route> routes = new ArrayList<>();

        for (Map.Entry<String, PathItem> entry : openAPI.getPaths().entrySet()) {
            String path = entry.getKey();
            PathItem pathItem = entry.getValue();

            addRouteIfPresent(routes, path, "GET", pathItem.getGet());
            addRouteIfPresent(routes, path, "POST", pathItem.getPost());
            addRouteIfPresent(routes, path, "PUT", pathItem.getPut());
            addRouteIfPresent(routes, path, "DELETE", pathItem.getDelete());
        }

        return routes;
    }

    private void addRouteIfPresent(List<Route> routes, String path, String method, Operation operation) {
        if (operation == null) return;

        Route route = new Route();
        route.setPath(path);
        route.setMethod(method);
        route.setParametersJson(
                operation.getParameters() != null ? operation.getParameters().toString() : "[]"
        );
        routes.add(route);
    }
}
