filename = "researchSync.txt"

local function initialize()
  global.config = global.config or {}
  global.lastProgressCheckAmount = global.lastProgressCheckAmount or 0
  log("init");
end

script.on_load(function()
  -- initialize()
end)

script.on_init(function()
  initialize()
end)

local function getLastResearchName(event)
  if (event.last_research) then
    return event.last_research.name
  else
    return "nothing"
  end
end

script.on_event(defines.events.on_research_started, function(event)
  game.write_file(filename, "s " .. event.research.name .. ' ' .. event.research.level .. "\n", true, 0)
  global.lastProgressCheckAmount = game.forces['player'].research_progress
end)

script.on_event(defines.events.on_research_finished, function(event)
  game.write_file(filename, "f " .. event.research.name .. ' ' .. event.research.level .. "\n", true, 0)
  global.lastProgressCheckAmount = 0
end)

remote.remove_interface("researchSync")
remote.add_interface("researchSync", {
  updateProgress = function(researchName, level, newProgress)
    if game.forces['player'].current_research and 
       game.forces['player'].current_research.name == researchName and
       game.forces['player'].current_research.level == level
    then
      -- calculate own progress
      local delta = game.forces['player'].research_progress - global.lastProgressCheckAmount
      global.lastProgressCheckAmount = math.min(1, newProgress + delta)
      game.forces['player'].research_progress = global.lastProgressCheckAmount
      return delta
    else
      if (game.forces['player'].technologies[researchName].level ~= level) then
        game.forces['player'].technologies[researchName].level = level
      end
      if newProgress < 1 then
        game.forces['player'].set_saved_technology_progress(researchName, newProgress)
      else
        game.forces['player'].technologies[researchName].researched = true
      end
      return 0 -- we assume we don't have any progress for not the current research
    end
  end,
  getCurrentResearch = function()
    local currentResearch = game.forces['player'].current_research
    if currentResearch then
      return currentResearch.name .. ' ' .. currentResearch.level
    else
      return ""
    end
  end
})