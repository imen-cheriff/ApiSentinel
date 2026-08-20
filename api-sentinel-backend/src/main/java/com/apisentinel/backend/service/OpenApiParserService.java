package com.apisentinel.backend.service;

import com.apisentinel.backend.entity.Endpoint;
import com.apisentinel.backend.entity.Parameter;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.Operation;
import io.swagger.v3.oas.models.PathItem;
import io.swagger.v3.parser.OpenAPIV3Parser;
import io.swagger.v3.parser.core.models.SwaggerParseResult;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class OpenApiParserService {

    public List<Endpoint> parse(byte[] fileContent) {
        String content = new String(fileContent, StandardCharsets.UTF_8);

        OpenAPIV3Parser parser = new OpenAPIV3Parser();
        SwaggerParseResult result = parser.readContents(content, null, null);
        OpenAPI openAPI = result.getOpenAPI();

        if (openAPI == null) {
            throw new IllegalArgumentException(
                    "Fichier OpenAPI invalide : " + result.getMessages());
        }

        List<Endpoint> endpoints = new ArrayList<>();

        for (Map.Entry<String, PathItem> entry : openAPI.getPaths().entrySet()) {
            String path = entry.getKey();
            PathItem pathItem = entry.getValue();

            addEndpointIfPresent(endpoints, path, "GET", pathItem.getGet());
            addEndpointIfPresent(endpoints, path, "POST", pathItem.getPost());
            addEndpointIfPresent(endpoints, path, "PUT", pathItem.getPut());
            addEndpointIfPresent(endpoints, path, "DELETE", pathItem.getDelete());
            addEndpointIfPresent(endpoints, path, "PATCH", pathItem.getPatch());
        }

        return endpoints;
    }

    private void addEndpointIfPresent(List<Endpoint> endpoints, String path, String method, Operation operation) {
        if (operation == null) return;

        Endpoint endpoint = new Endpoint();
        endpoint.setPath(path);
        endpoint.setMethod(method);
        endpoint.setSummary(operation.getSummary());
        endpoint.setDescription(operation.getDescription());
        endpoint.setEndpointId("ep_" + method.toLowerCase() + "_" + path.replaceAll("[/{}]", "_"));

        List<Parameter> parameters = new ArrayList<>();
        if (operation.getParameters() != null) {
            for (io.swagger.v3.oas.models.parameters.Parameter swaggerParam : operation.getParameters()) {
                Parameter parameter = new Parameter();
                parameter.setName(swaggerParam.getName());
                parameter.setInType(swaggerParam.getIn());
                parameter.setRequired(swaggerParam.getRequired() != null && swaggerParam.getRequired());
                parameter.setDataType(
                        swaggerParam.getSchema() != null && swaggerParam.getSchema().getType() != null
                                ? swaggerParam.getSchema().getType()
                                : "string"
                );
                parameter.setEndpoint(endpoint);
                parameters.add(parameter);
            }
        }
        endpoint.setParameters(parameters);

        endpoints.add(endpoint);
    }
}