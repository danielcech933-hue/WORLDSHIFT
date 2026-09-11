-- ROBLOX FORGE Studio bridge v0.1
-- Install as a local Studio plugin while Forge is running on localhost:43117.

local HttpService = game:GetService("HttpService")
local Selection = game:GetService("Selection")
local StudioService = game:GetService("StudioService")

local BASE_URL = "http://127.0.0.1:43117"
local INTERVAL = 2

local function request(method, path, body)
    local ok, response = pcall(function()
        return HttpService:RequestAsync({
            Url = BASE_URL .. path,
            Method = method,
            Headers = {
                ["Content-Type"] = "application/json",
            },
            Body = body and HttpService:JSONEncode(body) or nil,
        })
    end)

    if not ok then
        return false, tostring(response)
    end

    if not response.Success then
        return false, string.format("HTTP %d: %s", response.StatusCode, response.StatusMessage)
    end

    local decoded = nil
    if response.Body and response.Body ~= "" then
        pcall(function()
            decoded = HttpService:JSONDecode(response.Body)
        end)
    end
    return true, decoded
end

local function describeSelection()
    local result = {}
    for _, instance in ipairs(Selection:Get()) do
        table.insert(result, {
            name = instance.Name,
            className = instance.ClassName,
            fullName = instance:GetFullName(),
        })
    end
    return result
end

local function buildSnapshot()
    local activeScript = StudioService.ActiveScript
    return {
        timestamp = os.date("!%Y-%m-%dT%H:%M:%SZ"),
        placeName = game.Name,
        placeId = game.PlaceId,
        gameId = game.GameId,
        selection = describeSelection(),
        activeScript = activeScript and {
            name = activeScript.Name,
            className = activeScript.ClassName,
            fullName = activeScript:GetFullName(),
        } or nil,
        workspaceChildren = (function()
            local children = {}
            for _, child in ipairs(workspace:GetChildren()) do
                table.insert(children, {
                    name = child.Name,
                    className = child.ClassName,
                })
            end
            return children
        end)(),
    }
end

task.spawn(function()
    while true do
        local snapshot = buildSnapshot()
        request("POST", "/api/studio/state", snapshot)
        task.wait(INTERVAL)
    end
end)

print("[ROBLOX FORGE] Studio bridge started on " .. BASE_URL)
