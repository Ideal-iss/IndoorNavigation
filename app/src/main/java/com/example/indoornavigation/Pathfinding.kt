// Pathfinding.kt
data class Node(val x: Int, val y: Int, var g: Int = 0, var h: Int = 0) {
    val f: Int get() = g + h
    override fun equals(other: Any?) = other is Node && x == other.x && y == other.y
    override fun hashCode() = x * 31 + y
}

fun findPath(
    grid: Array<IntArray>,
    start: Node,
    goal: Node
): List<Node>? {
    val openSet = mutableListOf<Node>()
    val closedSet = mutableSetOf<Node>()
    val cameFrom = mutableMapOf<Node, Node>()

    openSet.add(start)

    while (openSet.isNotEmpty()) {
        val current = openSet.minByOrNull { it.f }!!
        if (current == goal) {
            // Восстановить путь
            val path = mutableListOf<Node>()
            var node = current
            while (node != start) {
                path.add(node)
                node = cameFrom[node] ?: break
            }
            path.add(start)
            return path.reversed()
        }

        openSet.remove(current)
        closedSet.add(current)

        for ((dx, dy) in listOf(0 to 1, 1 to 0, 0 to -1, -1 to 0)) {
            val nx = current.x + dx
            val ny = current.y + dy
            if (nx !in grid.indices || ny !in grid[0].indices) continue
            if (grid[nx][ny] == 1) continue // стена
            val neighbor = Node(nx, ny)

            if (neighbor in closedSet) continue

            val tentativeG = current.g + 1
            if (neighbor !in openSet) {
                openSet.add(neighbor)
            } else if (tentativeG >= neighbor.g) {
                continue
            }

            cameFrom[neighbor] = current
            neighbor.g = tentativeG
            neighbor.h = Math.abs(neighbor.x - goal.x) + Math.abs(neighbor.y - goal.y) // Manhattan
        }
    }
    return null // путь не найден
}